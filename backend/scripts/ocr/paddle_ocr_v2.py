#!/usr/bin/env python3
"""Improved OCR engine for Indonesian receipts (v2)."""
import argparse
import json
import logging
import os
import re
import sys
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

try:
    import cv2
except Exception as exc:
    print(f"Missing opencv dependency: {exc}", file=sys.stderr)
    raise

try:
    from paddleocr import PaddleOCR
except Exception as exc:
    print(f"Missing paddleocr dependency: {exc}", file=sys.stderr)
    raise

try:
    from PIL import Image, ImageOps
except Exception as exc:
    print(f"Missing pillow dependency: {exc}", file=sys.stderr)
    raise

try:
    from pdf2image import convert_from_path
except Exception:
    convert_from_path = None

LOG = logging.getLogger("ocr_v2")
logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")

MAX_AMOUNT = 999_999_999
MIN_AMOUNT = 1_000
MAX_VALID_AMOUNT = 100_000_000
MIN_HANDWRITTEN_AMOUNT = 10_000

AMOUNT_RE = re.compile(
    r"(?:(?:rp|idr)\s*)?(\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)",
    re.IGNORECASE,
)

TOTAL_KEYWORDS = [
    "total",
    "t0tal",
    "sub total",
    "subtotal",
    "grand total",
    "jumlah",
    "total bayar",
    "total pembayaran",
]

NEGATIVE_NEAR = [
    "trx",
    "id",
    "no",
    "ref",
]

RETAIL_MARKERS = ["subtotal", "diskon", "discount", "service", "ppn", "tax"]
INSTITUTIONAL_MARKERS = ["kwitansi", "invoice", "faktur", "sebesar", "terbilang"]
PAYMENT_MARKERS = ["transfer", "bank", "rekening", "va", "virtual account", "qris", "qr", "merchant"]
SIMPLE_MARKERS = ["paid", "bukti", "proof"]


def parse_amount(raw: str) -> Optional[int]:
    text = raw.lower().replace("rp", "").replace("idr", "")
    text = text.replace(" ", "").strip()
    if not text:
        return None

    if "," in text and "." in text:
        last_comma = text.rfind(",")
        last_dot = text.rfind(".")
        if last_comma > last_dot:
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", "")
    elif "." in text and "," not in text:
        parts = text.split(".")
        if len(parts) > 2:
            text = text.replace(".", "")
        else:
            right = parts[1] if len(parts) == 2 else ""
            if len(right) == 3:
                text = text.replace(".", "")
    elif "," in text and "." not in text:
        parts = text.split(",")
        if len(parts) > 2:
            text = text.replace(",", "")
        else:
            right = parts[1] if len(parts) == 2 else ""
            if len(right) <= 2:
                text = text.replace(",", ".")
            else:
                text = text.replace(",", "")

    text = text.replace(".", "")

    if not text.isdigit():
        return None

    value = int(text)
    if value <= 0 or value > MAX_AMOUNT:
        return None
    return value


def polygon_area(points: List[List[float]]) -> float:
    area = 0.0
    n = len(points)
    for i in range(n):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % n]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2.0


class OCRProcessor:
    """OCR processing and preprocessing pipeline."""

    def __init__(self) -> None:
        self.ocr = PaddleOCR(use_angle_cls=True, lang="latin", use_gpu=False, show_log=False)

    def preprocess(self, image: Image.Image, handwritten: bool) -> Image.Image:
        image = image.convert("RGB")
        if image.width > 1600:
            ratio = 1600 / image.width
            new_size = (1600, int(image.height * ratio))
            image = image.resize(new_size)

        image = ImageOps.autocontrast(image)

        if handwritten:
            gray = np.array(image.convert("L"))
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            thresh = cv2.adaptiveThreshold(
                blurred,
                255,
                cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv2.THRESH_BINARY,
                25,
                15,
            )
            kernel = np.ones((2, 2), np.uint8)
            dilated = cv2.dilate(thresh, kernel, iterations=1)
            image = Image.fromarray(dilated).convert("RGB")

        return image

    def run(self, image: Image.Image, handwritten: bool, conf_threshold: float) -> List[Dict[str, Any]]:
        try:
            prepared = self.preprocess(image, handwritten)
            np_img = np.array(prepared)
            result = self.ocr.ocr(np_img, cls=True)
        except Exception as exc:
            LOG.warning("OCR failed: %s", exc)
            return []

        normalized = self._normalize_result(result)
        lines = []
        for line in normalized:
            if not line or len(line) < 2:
                continue
            box = line[0]
            text = line[1][0]
            conf = float(line[1][1]) if len(line[1]) > 1 else 0.0
            if not text or conf < conf_threshold:
                continue
            lines.append(
                {
                    "text": text,
                    "confidence": conf,
                    "bbox": [coord for pt in box for coord in pt],
                    "box_points": box,
                }
            )
        return lines

    @staticmethod
    def _normalize_result(result: Any) -> List[Any]:
        if not result:
            return []
        if len(result) == 1 and isinstance(result[0], list):
            if result[0] and isinstance(result[0][0], list) and len(result[0][0]) == 2:
                return result[0]
        return result


class ReceiptClassifier:
    """Classify receipt category using keyword and heuristic signals."""

    def classify(self, lines: List[Dict[str, Any]]) -> str:
        if not lines:
            return "unknown"

        texts = [l["text"].lower() for l in lines]
        avg_conf = sum(l["confidence"] for l in lines) / len(lines)

        heights = [self._bbox_height(l["bbox"]) for l in lines]
        variance = np.var(heights) if heights else 0.0
        short_boxes = sum(1 for t in texts if len(t) <= 6)
        numeric_lines = sum(1 for t in texts if re.fullmatch(r"[\d.,\s]+", t))
        density_short = short_boxes / max(len(texts), 1)
        ratio_numeric = numeric_lines / max(len(texts), 1)

        retail_score = sum(1 for kw in RETAIL_MARKERS if kw in "\n".join(texts))
        institutional_score = sum(1 for kw in INSTITUTIONAL_MARKERS if kw in "\n".join(texts))
        payment_score = sum(1 for kw in PAYMENT_MARKERS if kw in "\n".join(texts))
        simple_score = sum(1 for kw in SIMPLE_MARKERS if kw in "\n".join(texts))

        if avg_conf < 0.75 and variance > 200 and density_short > 0.25:
            return "handwritten"

        if retail_score >= 2:
            return "retail_printed"

        if institutional_score >= 1:
            return "institutional_kuitansi"

        if payment_score >= 2 and retail_score == 0:
            return "digital_payment"

        if simple_score >= 1 and ratio_numeric > 0.3:
            return "simple_proof"

        return "unknown"

    @staticmethod
    def _bbox_height(bbox: List[float]) -> float:
        ys = bbox[1::2]
        return max(ys) - min(ys) if ys else 0.0


class ReceiptSegmenter:
    """Split a page into up to two receipt groups by vertical gaps."""

    def segment(self, lines: List[Dict[str, Any]], page_height: int) -> List[List[Dict[str, Any]]]:
        if not lines:
            return []

        lines_sorted = sorted(lines, key=lambda l: self._y_center(l["bbox"]))
        y_centers = [self._y_center(l["bbox"]) for l in lines_sorted]

        max_gap = 0
        split_idx = None
        for i in range(1, len(y_centers)):
            gap = y_centers[i] - y_centers[i - 1]
            if gap > max_gap:
                max_gap = gap
                split_idx = i

        if max_gap > page_height * 0.25 and split_idx is not None:
            group1 = lines_sorted[:split_idx]
            group2 = lines_sorted[split_idx:]
            groups = [group1, group2]
        else:
            groups = [lines_sorted]

        if len(groups) > 2:
            groups = self._merge_smallest(groups)

        return groups[:2]

    @staticmethod
    def _y_center(bbox: List[float]) -> float:
        ys = bbox[1::2]
        return sum(ys) / len(ys) if ys else 0.0

    @staticmethod
    def _merge_smallest(groups: List[List[Dict[str, Any]]]) -> List[List[Dict[str, Any]]]:
        groups = sorted(groups, key=len)
        smallest = groups.pop(0)
        groups[0].extend(smallest)
        return groups


class TotalExtractor:
    """Extract total amount from a receipt group."""

    def extract(self, lines: List[Dict[str, Any]], page_height: int) -> Optional[Dict[str, Any]]:
        if not lines:
            return None

        try:
            stage1 = self._stage_keyword(lines)
            if stage1:
                return stage1
            stage2 = self._stage_position(lines, page_height)
            if stage2:
                return stage2
        except Exception as exc:
            LOG.warning("Total extraction failed: %s", exc)
            return None

        return None

    def _stage_keyword(self, lines: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        for line in lines:
            text = line["text"].lower()
            if not self._keyword_match(text):
                continue
            amounts = self._amounts_in_text(text)
            if not amounts:
                continue
            amount = max(amounts)
            score = self._score(amount, keyword=True, bottom=False, highest=True, confidence=line["confidence"])
            if score < 0.6:
                return None
            return {"total": amount, "confidence": score}
        return None

    def _stage_position(self, lines: List[Dict[str, Any]], page_height: int) -> Optional[Dict[str, Any]]:
        bottom_threshold = page_height * 0.6
        candidates = []
        for line in lines:
            text = line["text"].lower()
            if any(k in text for k in NEGATIVE_NEAR):
                continue
            if re.search(r"\b\d{9,}\b", text):
                continue
            for amount in self._amounts_in_text(text):
                if amount < MIN_AMOUNT or amount > MAX_VALID_AMOUNT:
                    continue
                y_center = self._y_center(line["bbox"])
                if y_center < bottom_threshold:
                    continue
                candidates.append((amount, line["confidence"], y_center))

        if not candidates:
            return None

        candidates.sort(key=lambda x: x[0], reverse=True)
        amount, conf, y_center = candidates[0]
        score = self._score(amount, keyword=False, bottom=True, highest=True, confidence=conf)
        if score < 0.6:
            return None
        return {"total": amount, "confidence": score}

    @staticmethod
    def _keyword_match(text: str) -> bool:
        normalized = text.replace("0", "o")
        for kw in TOTAL_KEYWORDS:
            if kw in normalized:
                return True
        return False

    @staticmethod
    def _amounts_in_text(text: str) -> List[int]:
        amounts = []
        for match in AMOUNT_RE.finditer(text):
            raw = match.group(1)
            value = parse_amount(raw)
            if value is None:
                continue
            if value < MIN_AMOUNT or value > MAX_VALID_AMOUNT:
                continue
            if len(str(value)) > 12:
                continue
            amounts.append(value)
        return amounts

    @staticmethod
    def _score(amount: int, keyword: bool, bottom: bool, highest: bool, confidence: float) -> float:
        score = 0.0
        if keyword:
            score += 0.4
        if bottom:
            score += 0.2
        if highest:
            score += 0.2
        score += min(confidence, 1.0) * 0.2
        return score

    @staticmethod
    def _y_center(bbox: List[float]) -> float:
        ys = bbox[1::2]
        return sum(ys) / len(ys) if ys else 0.0


class OCRService:
    """End-to-end OCR pipeline."""

    def __init__(self) -> None:
        self.processor = OCRProcessor()
        self.classifier = ReceiptClassifier()
        self.segmenter = ReceiptSegmenter()
        self.extractor = TotalExtractor()

    def process(self, input_path: str) -> Dict[str, Any]:
        pages = self._load_pages(input_path)
        if not pages:
            return {"error": "No pages to process", "grand_total": None}

        grand_total = 0
        receipt_count = 0
        category_detected = []
        per_page = []
        all_text = []
        page_confidences = []

        for idx, image in enumerate(pages, start=1):
            page_result = self._process_page(image)
            per_page.append({"page": idx, **page_result})

            all_text.extend(page_result.get("raw_text", []))
            page_confidences.append(page_result.get("avg_confidence", 0.0))

            page_total = page_result.get("page_total")
            if page_total:
                grand_total += page_total
                receipt_count += page_result.get("receipt_count", 0)
                category_detected.extend(page_result.get("categories", []))

        avg_conf = sum(page_confidences) / len(page_confidences) if page_confidences else 0.0

        if grand_total == 0:
            return {
                "grand_total": None,
                "currency": "IDR",
                "confidence": round(avg_conf, 4),
                "receipt_count": 0,
                "category_detected": category_detected,
                "error": "No valid total detected",
                "per_page": per_page,
                "raw_text": "\n".join(all_text),
            }

        return {
            "grand_total": grand_total,
            "currency": "IDR",
            "confidence": round(avg_conf, 4),
            "receipt_count": receipt_count,
            "category_detected": category_detected,
            "per_page": per_page,
            "raw_text": "\n".join(all_text),
        }

    def _process_page(self, image: Image.Image) -> Dict[str, Any]:
        lines = self.processor.run(image, handwritten=False, conf_threshold=0.6)
        category = self.classifier.classify(lines)

        if category == "handwritten":
            lines = self.processor.run(image, handwritten=True, conf_threshold=0.5)

        groups = self.segmenter.segment(lines, image.height)
        if not groups:
            return {
                "page_total": 0,
                "receipt_count": 0,
                "categories": [category],
                "avg_confidence": self._avg_conf(lines),
                "raw_text": [l["text"] for l in lines],
            }

        totals = []
        for group in groups[:2]:
            total = self._extract_total_for_group(group, image.height)
            if total:
                totals.append(total)

        page_total = sum(t["total"] for t in totals) if totals else 0

        return {
            "page_total": page_total,
            "receipt_count": len(totals),
            "categories": [category],
            "avg_confidence": self._avg_conf(lines),
            "raw_text": [l["text"] for l in lines],
        }

    def _extract_total_for_group(self, group: List[Dict[str, Any]], page_height: int) -> Optional[Dict[str, Any]]:
        category = self.classifier.classify(group)
        if category == "handwritten":
            amounts = self._max_currency(group)
            if amounts is None:
                return None
            if amounts < MIN_HANDWRITTEN_AMOUNT:
                return None
            return {"total": amounts, "confidence": 0.6}

        if category == "digital_payment":
            amounts = self._max_currency(group)
            if amounts is None:
                return None
            return {"total": amounts, "confidence": 0.7}

        if category == "institutional_kuitansi":
            for line in group:
                if "sebesar" in line["text"].lower():
                    amounts = self._amounts_from_line(line["text"])
                    if amounts:
                        return {"total": max(amounts), "confidence": 0.7}

        if category == "simple_proof":
            amounts = self._max_currency(group)
            if amounts is None:
                return None
            return {"total": amounts, "confidence": 0.6}

        return self.extractor.extract(group, page_height)

    @staticmethod
    def _avg_conf(lines: List[Dict[str, Any]]) -> float:
        if not lines:
            return 0.0
        return sum(l["confidence"] for l in lines) / len(lines)

    @staticmethod
    def _max_currency(lines: List[Dict[str, Any]]) -> Optional[int]:
        amounts = []
        for line in lines:
            amounts.extend(OCRService._amounts_from_line(line["text"]))
        return max(amounts) if amounts else None

    @staticmethod
    def _amounts_from_line(text: str) -> List[int]:
        values = []
        for match in AMOUNT_RE.finditer(text):
            value = parse_amount(match.group(1))
            if value is None:
                continue
            if value < MIN_AMOUNT or value > MAX_VALID_AMOUNT:
                continue
            values.append(value)
        return values

    @staticmethod
    def _load_pages(input_path: str) -> List[Image.Image]:
        ext = os.path.splitext(input_path)[1].lower()
        if ext == ".pdf":
            if convert_from_path is None:
                return []
            return convert_from_path(input_path, dpi=300)
        return [Image.open(input_path)]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to input image or PDF")
    parser.add_argument("--json", action="store_true", help="Output JSON only")
    args = parser.parse_args()

    service = OCRService()
    result = service.process(args.input)

    if args.json:
        print(json.dumps(result, ensure_ascii=True))
    else:
        print(json.dumps(result, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
