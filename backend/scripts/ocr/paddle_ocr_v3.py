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

MAX_AMOUNT = 100_000_000
MIN_AMOUNT = 1_000
MAX_VALID_AMOUNT = 100_000_000
MIN_HANDWRITTEN_AMOUNT = 10_000
MIN_SCORE_THRESHOLD = 0.6
RETAIL_MIN_SCORE_THRESHOLD = 0.5

AMOUNT_RE = re.compile(
    r"(?:(?:rp|idr)\s*)?(\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)",
    re.IGNORECASE,
)
NOISY_AMOUNT_RE = re.compile(r"\d[\d.,\s]{3,}\d")

TOTAL_KEYWORDS = [
    "total",
    "t0tal",
    "sub total",
    "subtotal",
    "grand total",
    "jumlah",
    "jumlah tagihan",
    "tagihan",
    "total bayar",
    "total pembayaran",
]

RETAIL_RANK_KEYWORDS = [
    "total",
    "t0tal",
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
    "npwp",
    "resi",
    "nomor telepon",
    "telepon",
    "pelanggan",
    "tanggal",
    "jam",
]

V3_NEGATIVE_CONTEXT = [
    "trx",
    "id",
    "ref",
    "no ",
    "npwp",
    "resi",
    "nomor telepon",
    "telepon",
    "pelanggan",
    "tanggal",
    "saldo",
    "cashback",
    "admin",
    "biaya",
    "fee",
    "subtotal",
    "service",
    "charge",
    "ppn",
    "pb1",
    "tax",
]

RETAIL_MARKERS = ["subtotal", "diskon", "discount", "service", "ppn", "tax"]
INSTITUTIONAL_MARKERS = ["kwitansi", "invoice", "faktur", "sebesar", "terbilang"]
PAYMENT_MARKERS = ["transfer", "bank", "rekening", "va", "virtual account", "qris", "qr", "merchant"]
SIMPLE_MARKERS = ["paid", "bukti", "proof"]
RESI_TAGIHAN_MARKERS = [
    "jumlah tagihan",
    "tagihan",
    "no.resi",
    "nomor telepon",
    "pelanggan",
    "admin",
    "pospay",
]
BLOCKED_BILLING_TOKENS = [
    "npwp",
    "resi",
    "nomor telepon",
    "telepon",
    "pelanggan",
    "tanggal",
    "jam",
    "admin",
    "service",
    "charge",
    "ppn",
    "pb1",
    "tax",
    "subtotal",
]
SUMMARY_TEMPLATE_CATEGORY = "saldo_pengeluaran_summary"
SUMMARY_TEMPLATE_PAGE_KEYWORDS = [
    "laporan",
    "pertanggung jawaban",
    "pertanggungjawaban",
    "rekap",
    "rekapitulasi",
]


def parse_amount(raw: str) -> Optional[int]:
    text = raw.lower().replace("rp", "").replace("idr", "")
    text = text.replace(" ", "").strip()
    if not text:
        return None

    text = re.sub(r"[^0-9.,]", "", text)
    if not text:
        return None

    # OCR can split thousand groups oddly, e.g. 168.00,00 instead of 168.000,00.
    # Normalize this specific malformed pattern before generic parsing.
    if re.match(r"^\d{1,3}[.,]\d{2}[.,]00$", text):
        parts = re.split(r"[.,]", text)
        if len(parts) == 3:
            text = f"{parts[0]}{parts[1]}0,00"

    decimal_sep_match = re.search(r"([.,])(\d{2})$", text)
    decimal_sep = decimal_sep_match.group(1) if decimal_sep_match else None
    decimal_tail = decimal_sep_match.group(2) if decimal_sep_match else None

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

    if decimal_sep and decimal_tail == "00":
        stripped = re.sub(r"\D", "", text)
        if len(stripped) >= 3 and stripped.endswith("00"):
            text = stripped[:-2]

    text = text.replace(".", "")
    text = text.replace(",", "")

    if not text.isdigit():
        digits_only = re.sub(r"\D", "", text)
        if digits_only.isdigit():
            text = digits_only
        else:
            return None

    if not text.isdigit():
        return None

    value = int(text)
    if value <= 0 or value > MAX_AMOUNT:
        return None
    return value


def y_center(bbox: List[float]) -> float:
    ys = bbox[1::2]
    return sum(ys) / len(ys) if ys else 0.0


def x_center(bbox: List[float]) -> float:
    xs = bbox[0::2]
    return sum(xs) / len(xs) if xs else 0.0


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

        combined_text = "\n".join(texts)
        if "tagihan" in combined_text:
            return "resi_tagihan"
        retail_score = sum(1 for kw in RETAIL_MARKERS if kw in combined_text)
        institutional_score = sum(1 for kw in INSTITUTIONAL_MARKERS if kw in combined_text)
        payment_score = sum(1 for kw in PAYMENT_MARKERS if kw in combined_text)
        simple_score = sum(1 for kw in SIMPLE_MARKERS if kw in combined_text)
        resi_tagihan_score = sum(1 for kw in RESI_TAGIHAN_MARKERS if kw in combined_text)

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

        if resi_tagihan_score >= 3:
            return "resi_tagihan"

        return "unknown"

    @staticmethod
    def _bbox_height(bbox: List[float]) -> float:
        ys = bbox[1::2]
        return max(ys) - min(ys) if ys else 0.0


class ReceiptSegmenter:
    """Split a page into up to two receipt groups (horizontal first, then vertical fallback)."""

    def segment(self, lines: List[Dict[str, Any]], page_height: int, page_width: int) -> List[List[Dict[str, Any]]]:
        if not lines:
            return []

        lines_sorted = sorted(lines, key=lambda l: x_center(l["bbox"]))
        x_centers = [x_center(l["bbox"]) for l in lines_sorted]

        max_x_gap = 0
        x_split_idx = None
        for i in range(1, len(x_centers)):
            gap = x_centers[i] - x_centers[i - 1]
            if gap > max_x_gap:
                max_x_gap = gap
                x_split_idx = i

        # Primary split: left/right receipts
        if max_x_gap > page_width * 0.2 and x_split_idx is not None:
            group1 = lines_sorted[:x_split_idx]
            group2 = lines_sorted[x_split_idx:]
            groups = [group1, group2]
        else:
            # Fallback split: top/bottom receipts
            lines_y_sorted = sorted(lines, key=lambda l: y_center(l["bbox"]))
            y_centers = [y_center(l["bbox"]) for l in lines_y_sorted]

            max_y_gap = 0
            y_split_idx = None
            for i in range(1, len(y_centers)):
                gap = y_centers[i] - y_centers[i - 1]
                if gap > max_y_gap:
                    max_y_gap = gap
                    y_split_idx = i

            if max_y_gap > page_height * 0.12 and y_split_idx is not None:
                group1 = lines_y_sorted[:y_split_idx]
                group2 = lines_y_sorted[y_split_idx:]
                groups = [group1, group2]
            else:
                groups = [lines_sorted]

        if len(groups) > 2:
            groups = self._merge_smallest(groups)

        return groups[:2]

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
            stage1b = self._stage_keyword_neighbor(lines)
            if stage1b:
                return stage1b
            stage2 = self._stage_position(lines, page_height)
            if stage2:
                return stage2
        except Exception as exc:
            LOG.warning("Total extraction failed: %s", exc)
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
            score = self._score(keyword=True, bottom=False, confidence=line["confidence"])
            if score < MIN_SCORE_THRESHOLD:
                continue
            return {"total": amount, "confidence": score, "bbox": line["bbox"]}
        return None

    def _stage_position(self, lines: List[Dict[str, Any]], page_height: int) -> Optional[Dict[str, Any]]:
        bottom_threshold = page_height * 0.6
        candidates: List[Tuple[float, int, float, List[float]]] = []
        keyword_candidates: List[Tuple[float, int, float, List[float]]] = []
        for line in lines:
            text = line["text"].lower()
            if any(k in text for k in NEGATIVE_NEAR):
                continue
            if re.search(r"\b\d{9,}\b", text):
                continue
            has_keyword = self._keyword_match(text)
            for amount in self._amounts_in_text(text):
                if amount < MIN_AMOUNT or amount > MAX_VALID_AMOUNT:
                    continue
                yc = y_center(line["bbox"])
                if yc < bottom_threshold:
                    continue
                conf = float(line.get("confidence", 0.0))
                score = self._score(keyword=has_keyword, bottom=True, confidence=conf)
                if has_keyword:
                    score += 0.12
                entry = (score, amount, conf, line["bbox"])
                candidates.append(entry)
                if has_keyword:
                    keyword_candidates.append(entry)

        ranked = keyword_candidates if keyword_candidates else candidates
        if not ranked:
            return None

        ranked.sort(key=lambda x: (x[0], x[1]), reverse=True)
        score, amount, _conf, bbox = ranked[0]
        if score < MIN_SCORE_THRESHOLD:
            return None
        return {"total": amount, "confidence": score, "bbox": bbox}

    def _stage_keyword_neighbor(self, lines: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        ordered = sorted(lines, key=lambda l: y_center(l["bbox"]))
        candidates: List[Tuple[int, float, List[float]]] = []

        for idx, line in enumerate(ordered):
            text = line["text"].lower()
            if not self._keyword_match(text):
                continue

            # If same-line keyword extraction exists, stage_keyword has handled it already.
            for next_idx in range(idx + 1, min(idx + 6, len(ordered))):
                next_line = ordered[next_idx]
                next_text = next_line["text"].lower()
                if any(k in next_text for k in NEGATIVE_NEAR):
                    continue
                for amount in self._amounts_in_text(next_text):
                    if amount < MIN_AMOUNT or amount > MAX_VALID_AMOUNT:
                        continue
                    score = 0.58
                    score += min(float(line.get("confidence", 0.0)), 1.0) * 0.15
                    score += min(float(next_line.get("confidence", 0.0)), 1.0) * 0.15
                    score += (amount / MAX_VALID_AMOUNT) * 0.12
                    distance_penalty = (next_idx - idx) * 0.03
                    score -= distance_penalty
                    candidates.append((amount, score, next_line["bbox"]))

        if not candidates:
            return None

        candidates.sort(key=lambda item: (item[1], item[0]), reverse=True)
        amount, score, bbox = candidates[0]
        if score < 0.5:
            return None
        return {"total": amount, "confidence": round(min(score, 1.0), 4), "bbox": bbox}

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
    def _score(keyword: bool, bottom: bool, confidence: float) -> float:
        score = 0.0
        if keyword:
            score += 0.4
        if bottom:
            score += 0.2
        score += 0.2
        score += min(confidence, 1.0) * 0.2
        return score


class OCRService:
    """End-to-end OCR pipeline."""

    def __init__(self) -> None:
        self.processor = OCRProcessor()
        self.classifier = ReceiptClassifier()
        self.segmenter = ReceiptSegmenter()
        self.extractor = TotalExtractor()

    @staticmethod
    def _summary_template_mode() -> str:
        mode = (os.getenv("OCR_SUMMARY_TEMPLATE_MODE") or "strict").strip().lower()
        return mode if mode in {"strict", "lenient"} else "strict"

    def process(self, input_path: str) -> Dict[str, Any]:
        pages = self._load_pages(input_path)
        if not pages:
            return {"error": "No pages to process", "grand_total": None}

        focus_page_indexes = self._find_summary_focus_page_indexes(pages)
        summary_template = self._detect_summary_template(pages, focus_page_indexes)
        if summary_template is not None:
            detected_page = summary_template["page"]
            detected_total = summary_template["total"]
            detected_conf = summary_template["confidence"]
            detected_lines = summary_template["lines"]
            return {
                "grand_total": detected_total,
                "currency": "IDR",
                "confidence": round(detected_conf, 4),
                "receipt_count": 1,
                "category_detected": [SUMMARY_TEMPLATE_CATEGORY],
                "per_page": [
                    {
                        "page": detected_page,
                        "page_total": detected_total,
                        "receipt_count": 1,
                        "receipts": [
                            {
                                "total": detected_total,
                                "confidence": round(detected_conf, 4),
                            }
                        ],
                        "categories": [SUMMARY_TEMPLATE_CATEGORY],
                        "avg_confidence": self._avg_conf(detected_lines),
                        "raw_text": [l["text"] for l in detected_lines],
                    }
                ],
                "raw_text": "\n".join(l["text"] for l in detected_lines),
            }

        if focus_page_indexes:
            focus_idx = focus_page_indexes[0]
            page_result = self._process_page(pages[focus_idx])
            raw_text = page_result.get("raw_text", [])
            page_total = page_result.get("page_total", 0)
            response = {
                "currency": "IDR",
                "confidence": round(page_result.get("avg_confidence", 0.0), 4),
                "receipt_count": page_result.get("receipt_count", 0),
                "category_detected": page_result.get("categories", []),
                "per_page": [{"page": focus_idx + 1, **page_result}],
                "raw_text": "\n".join(raw_text),
            }
            if page_total:
                response["grand_total"] = page_total
            else:
                response["grand_total"] = None
                response["error"] = "No valid total detected"
            return response

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

    @staticmethod
    def _has_summary_focus_keyword(lines: List[Dict[str, Any]]) -> bool:
        text_joined = "\n".join(line["text"].lower() for line in lines)
        normalized_text = re.sub(r"[^a-z0-9]+", " ", text_joined)
        normalized_text = re.sub(r"\s+", " ", normalized_text).strip()
        if any(keyword in normalized_text for keyword in SUMMARY_TEMPLATE_PAGE_KEYWORDS):
            return True
        return "pertanggung" in normalized_text and "jawab" in normalized_text

    def _score_summary_page(self, lines: List[Dict[str, Any]], page_width: int, page_height: int) -> float:
        if not lines:
            return 0.0

        text_joined = "\n".join(line["text"].lower() for line in lines)
        normalized_text = re.sub(r"[^a-z0-9]+", " ", text_joined)
        normalized_text = re.sub(r"\s+", " ", normalized_text).strip()

        has_laporan = "laporan" in normalized_text
        has_rekap = "rekap" in normalized_text or "rekapitulasi" in normalized_text
        has_pengeluaran = "pengeluaran" in normalized_text
        has_pertanggungjawaban = (
            "pertanggung jawaban" in normalized_text
            or "pertanggungjawaban" in normalized_text
            or ("pertanggung" in normalized_text and "jawab" in normalized_text)
        )
        has_generic_total = "jumlah" in normalized_text or "total" in normalized_text

        score = 0.0
        if has_laporan or has_rekap:
            score += 0.35
        if has_pertanggungjawaban:
            score += 0.25
        if has_pengeluaran:
            score += 0.2
        if has_generic_total and not (has_laporan or has_rekap or has_pengeluaran or has_pertanggungjawaban):
            score -= 0.2

        keyword_lines = [
            line
            for line in lines
            if re.search(r"lapor|rekap|pertanggung|jawab", line["text"], re.IGNORECASE)
        ]
        pengeluaran_lines = [line for line in lines if "pengeluaran" in line["text"].lower()]
        if keyword_lines and pengeluaran_lines:
            title_line = sorted(keyword_lines, key=lambda line: y_center(line["bbox"]))[0]
            pengeluaran_line = sorted(pengeluaran_lines, key=lambda line: y_center(line["bbox"]))[0]
            title_y = y_center(title_line["bbox"])
            header_y = y_center(pengeluaran_line["bbox"])
            if title_y < page_height * 0.45 and (title_y + 20.0) < header_y < page_height * 0.75:
                score += 0.25

        if pengeluaran_lines:
            header = sorted(pengeluaran_lines, key=lambda line: y_center(line["bbox"]))[0]
            header_x = x_center(header["bbox"])
            header_y = y_center(header["bbox"])
            x_tolerance = max(page_width * 0.2, 90)

            column_amount_hits = 0
            for line in lines:
                yc = y_center(line["bbox"])
                if yc <= header_y:
                    continue
                xc = x_center(line["bbox"])
                if abs(xc - header_x) > x_tolerance:
                    continue
                if self._amounts_from_line(line["text"].lower()):
                    column_amount_hits += 1

            if column_amount_hits >= 2:
                score += min(0.3, 0.18 + (column_amount_hits - 2) * 0.04)

        return score

    def _find_summary_focus_page_indexes(self, pages: List[Image.Image]) -> List[int]:
        scored_indexes: List[Tuple[int, float]] = []
        for page_idx, image in enumerate(pages):
            lines = self.processor.run(image, handwritten=False, conf_threshold=0.35)
            if self._has_summary_focus_keyword(lines):
                score = self._score_summary_page(lines, image.width, image.height)
                scored_indexes.append((page_idx, score))

        if not scored_indexes:
            return []

        scored_indexes.sort(key=lambda item: (item[1], 1 if item[0] == 0 else 0, -item[0]), reverse=True)
        return [page_idx for page_idx, _ in scored_indexes]

    def _detect_summary_template(
        self,
        pages: List[Image.Image],
        focus_page_indexes: Optional[List[int]] = None,
    ) -> Optional[Dict[str, Any]]:
        if not pages:
            return None

        candidate_pages: List[Tuple[int, Image.Image, List[Dict[str, Any]]]] = []
        header_hint_x: Optional[float] = None
        if focus_page_indexes:
            candidate_indexes = focus_page_indexes
        else:
            candidate_indexes = sorted(range(len(pages)), key=lambda idx: (0 if idx == 0 else 1, idx))

        for page_idx in candidate_indexes:
            image = pages[page_idx]
            lines = self.processor.run(image, handwritten=False, conf_threshold=0.35)
            candidate_pages.append((page_idx, image, lines))
            if header_hint_x is None:
                header_lines = [line for line in lines if "pengeluaran" in line["text"].lower()]
                if header_lines:
                    header_hint_x = x_center(header_lines[0]["bbox"])

        for page_idx, image, lines in candidate_pages:
            if not lines:
                continue

            extracted = self._extract_pengeluaran_summary_total(lines, image.width, image, header_hint_x)
            if extracted is None:
                continue

            amount, conf, bbox = extracted
            return {
                "page": page_idx + 1,
                "total": amount,
                "confidence": conf,
                "bbox": bbox,
                "lines": lines,
            }

        return None

    def _extract_pengeluaran_summary_total(
        self,
        lines: List[Dict[str, Any]],
        page_width: int,
        image: Optional[Image.Image] = None,
        header_hint_x: Optional[float] = None,
    ) -> Optional[Tuple[int, float, List[float]]]:
        text_joined = "\n".join(line["text"].lower() for line in lines)
        normalized_text = re.sub(r"[^a-z0-9]+", " ", text_joined)
        normalized_text = re.sub(r"\s+", " ", normalized_text).strip()

        # Strict template gate: must be a reference report table page.
        has_pengeluaran = "pengeluaran" in normalized_text
        has_saldo = "saldo" in normalized_text
        has_laporan = "laporan" in normalized_text
        has_rekap = "rekap" in normalized_text or "rekapitulasi" in normalized_text
        has_pertanggungjawaban = (
            "laporan pertanggung jawaban" in normalized_text
            or "laporan pertanggungjawaban" in normalized_text
            or "pertanggungjawaban" in normalized_text
            or ("pertanggung" in normalized_text and "jawab" in normalized_text)
        )

        has_table_terms = any(token in text_joined for token in ["saldo", "debet", "kredit", "jumlah", "total"])
        amount_density = sum(len(self._amounts_from_line(line["text"].lower())) for line in lines)
        header_lines = [line for line in lines if "pengeluaran" in line["text"].lower()]
        has_header_context = bool(header_lines or header_hint_x is not None)

        column_amount_hits = 0
        if has_header_context:
            if header_lines:
                header = header_lines[0]
                gate_header_x = x_center(header["bbox"])
                gate_header_y = y_center(header["bbox"])
            else:
                gate_header_x = float(header_hint_x)
                gate_header_y = min(y_center(line["bbox"]) for line in lines)
            gate_x_tolerance = max(page_width * 0.22, 90)
            for line in lines:
                yc = y_center(line["bbox"])
                if yc <= gate_header_y:
                    continue
                xc = x_center(line["bbox"])
                if abs(xc - gate_header_x) > gate_x_tolerance:
                    continue
                column_amount_hits += len(self._amounts_from_line(line["text"].lower()))

        mode = self._summary_template_mode()
        if mode == "strict":
            if not (has_pengeluaran and has_saldo and has_laporan and has_pertanggungjawaban):
                return None
            if not has_table_terms or amount_density < 2:
                return None
        else:
            # Lenient mode: prioritize summary-context + pengeluaran-column evidence.
            has_reference_context = has_laporan or has_pertanggungjawaban or has_rekap
            has_column_context = has_header_context and column_amount_hits >= 1
            if not (
                (has_pengeluaran and has_reference_context and (amount_density >= 1 or has_column_context))
                or (has_reference_context and has_column_context)
                or (has_header_context and has_table_terms and amount_density >= 1)
            ):
                return None
            if amount_density < 1 and column_amount_hits < 1:
                return None

        # Strategy A2 only: when "Total" label is separated from numeric lines,
        # read neighboring lines after the label and pick pengeluaran order.
        ordered = sorted(lines, key=lambda l: y_center(l["bbox"]))
        total_label_candidates: List[Tuple[int, float, List[float], float]] = []
        for idx, line in enumerate(ordered):
            line_text = line["text"].lower()
            if "total" not in line_text:
                continue

            base_y = y_center(line["bbox"])
            collected_amounts: List[int] = []
            chosen_bbox = line["bbox"]

            # Only scan the NEXT 3 lines after Total label (more precise)
            for next_idx in range(idx + 1, min(idx + 4, len(ordered))):
                next_line = ordered[next_idx]
                next_y = y_center(next_line["bbox"])
                
                # Skip lines above (header) or too far below (other table sections)
                if next_y + 5 < base_y:
                    continue
                if next_y - base_y > 120:  # Reduced from 260px - Total row is compact
                    break

                next_amounts = self._amounts_from_line(next_line["text"].lower())
                if next_amounts:
                    collected_amounts.extend(next_amounts)
                    chosen_bbox = next_line["bbox"]

            if len(collected_amounts) >= 3:
                # If 3+ amounts found: [pemasukan, pengeluaran, saldo] -> pick middle one
                chosen_amount = collected_amounts[1]
            elif len(collected_amounts) == 2:
                # If exactly 2: typically [opening_total, pengeluaran] or [pengeluaran, saldo]
                # For summary with opening balance: opening > pengeluaran > saldo
                # Pengeluaran is typically between opening and saldo
                # Take the smaller value (assume pengeluaran is the smaller of the two)
                chosen_amount = min(collected_amounts)
            elif len(collected_amounts) == 1:
                chosen_amount = collected_amounts[0]
            else:
                chosen_amount = None
            
            if chosen_amount and chosen_amount >= 10_000:
                total_label_candidates.append((chosen_amount, 0.97, chosen_bbox, base_y))

        if not total_label_candidates:
            return None

        total_label_candidates.sort(key=lambda x: (x[3], x[1]), reverse=True)
        best_amount, best_conf, best_bbox, _ = total_label_candidates[0]
        return best_amount, best_conf, best_bbox

    def _process_page(self, image: Image.Image) -> Dict[str, Any]:
        lines = self.processor.run(image, handwritten=False, conf_threshold=0.6)
        page_category = self.classifier.classify(lines)

        groups = self.segmenter.segment(lines, image.height, image.width)
        if not groups:
            return {
                "page_total": 0,
                "receipt_count": 0,
                "categories": [page_category],
                "avg_confidence": self._avg_conf(lines),
                "raw_text": [l["text"] for l in lines],
            }

        totals = []
        group_categories = []
        for group in groups[:2]:
            group_category = self.classifier.classify(group)
            group_categories.append(group_category)

            group_lines = group
            if group_category == "handwritten":
                cropped = self._crop_group_region(image, group)
                if cropped:
                    crop_image, offset_x, offset_y = cropped
                    handwritten_lines = self.processor.run(crop_image, handwritten=True, conf_threshold=0.5)
                    if handwritten_lines:
                        group_lines = self._offset_group_lines(handwritten_lines, offset_x, offset_y)

            total = self._extract_total_for_group(group_lines, image.height)
            if total:
                totals.append(total)

        if len(totals) == 1 and "retail_printed" in group_categories:
            secondary = self._extract_retail_secondary_total(lines, image.height, totals[0]["total"])
            if secondary:
                totals.append(secondary)

        total_bayar = self._extract_total_bayar(lines)
        if total_bayar is not None:
            totals = [total_bayar]
            group_categories = ["resi_tagihan"]
        else:
            explicit_total = self._extract_explicit_jumlah_tagihan(lines)
            if explicit_total is not None:
                totals = [explicit_total]
                group_categories = ["resi_tagihan"]
            else:
                anchored_total = self._extract_tagihan_anchor_total(lines)
                if anchored_total is not None:
                    totals = [anchored_total]
                    group_categories = ["resi_tagihan"]

        page_total = sum(t["total"] for t in totals) if totals else 0

        return {
            "page_total": page_total,
            "receipt_count": len(totals),
            "receipts": [
                {
                    "total": t["total"],
                    "confidence": t["confidence"],
                }
                for t in totals
            ],
            "categories": group_categories,
            "avg_confidence": self._avg_conf(lines),
            "raw_text": [l["text"] for l in lines],
        }

    def _extract_explicit_jumlah_tagihan(self, lines: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        ordered = sorted(lines, key=lambda l: y_center(l["bbox"]))
        candidates: List[Tuple[float, int, List[float]]] = []

        for idx, line in enumerate(ordered):
            anchor_text = line["text"].lower()
            anchor_bonus = 0.0
            if "total bayar" in anchor_text or "total pembayaran" in anchor_text:
                anchor_bonus = 0.2
            elif "jumlah tagihan" in anchor_text:
                anchor_bonus = 0.08
            else:
                continue

            for next_idx in range(idx, min(idx + 4, len(ordered))):
                next_line = ordered[next_idx]
                next_text = next_line["text"].lower()
                if any(token in next_text for token in BLOCKED_BILLING_TOKENS):
                    continue
                confidence = min(float(next_line.get("confidence", 0.0)), 1.0)
                distance_penalty = (next_idx - idx) * 0.03
                for amount in self._amounts_from_line(next_text):
                    if amount < MIN_AMOUNT or amount > MAX_VALID_AMOUNT:
                        continue
                    score = 0.86 + confidence * 0.08 + anchor_bonus - distance_penalty
                    candidates.append((score, amount, next_line["bbox"]))

        if candidates:
            candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
            score, amount, bbox = candidates[0]
            return {"total": amount, "confidence": round(min(score, 1.0), 4), "bbox": bbox}

        return None

    @staticmethod
    def _crop_group_region(
        image: Image.Image,
        group: List[Dict[str, Any]],
        padding: int = 20,
    ) -> Optional[Tuple[Image.Image, int, int]]:
        if not group:
            return None

        xs: List[float] = []
        ys: List[float] = []
        for line in group:
            bbox = line.get("bbox", [])
            xs.extend(bbox[0::2])
            ys.extend(bbox[1::2])

        if not xs or not ys:
            return None

        min_x = max(int(min(xs)) - padding, 0)
        min_y = max(int(min(ys)) - padding, 0)
        max_x = min(int(max(xs)) + padding, image.width)
        max_y = min(int(max(ys)) + padding, image.height)

        if max_x <= min_x or max_y <= min_y:
            return None

        return image.crop((min_x, min_y, max_x, max_y)), min_x, min_y

    @staticmethod
    def _offset_group_lines(lines: List[Dict[str, Any]], offset_x: int, offset_y: int) -> List[Dict[str, Any]]:
        adjusted: List[Dict[str, Any]] = []
        for line in lines:
            new_line = dict(line)

            bbox = list(line.get("bbox", []))
            for i in range(0, len(bbox), 2):
                bbox[i] += offset_x
            for i in range(1, len(bbox), 2):
                bbox[i] += offset_y
            new_line["bbox"] = bbox

            box_points = line.get("box_points")
            if isinstance(box_points, list):
                new_line["box_points"] = [[pt[0] + offset_x, pt[1] + offset_y] for pt in box_points]

            adjusted.append(new_line)

        return adjusted

    def _extract_total_for_group(self, group: List[Dict[str, Any]], page_height: int) -> Optional[Dict[str, Any]]:
        category = self.classifier.classify(group)
        if category == "handwritten":
            result = self._max_currency_with_bbox(group)
            if result is None:
                return None
            amounts, bbox = result
            if amounts < MIN_HANDWRITTEN_AMOUNT:
                return None
            return {"total": amounts, "confidence": 0.6, "bbox": bbox}

        if category == "retail_printed":
            return self._extract_retail_v3_ranked(group, page_height)

        if category == "digital_payment":
            result = self._max_currency_with_bbox(group)
            if result is None:
                return None
            amounts, bbox = result
            return {"total": amounts, "confidence": 0.7, "bbox": bbox}

        if category == "institutional_kuitansi":
            for line in group:
                if "sebesar" in line["text"].lower():
                    amounts = self._amounts_from_line(line["text"])
                    if amounts:
                        return {"total": max(amounts), "confidence": 0.7, "bbox": line["bbox"]}

        if category == "simple_proof":
            result = self._max_currency_with_bbox(group)
            if result is None:
                return None
            amounts, bbox = result
            return {"total": amounts, "confidence": 0.6, "bbox": bbox}

        if category == "resi_tagihan":
            total_bayar = self._extract_total_bayar(group)
            if total_bayar is not None:
                return total_bayar
            explicit_total = self._extract_explicit_jumlah_tagihan(group)
            if explicit_total is not None:
                return explicit_total
            anchored_total = self._extract_tagihan_anchor_total(group)
            if anchored_total is not None:
                return anchored_total
            return self._extract_unknown_billing_total(group)

        if category == "unknown":
            billing_total = self._extract_unknown_billing_total(group)
            if billing_total is not None:
                return billing_total

        return self.extractor.extract(group, page_height)

    def _extract_unknown_billing_total(self, lines: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        ordered = sorted(lines, key=lambda l: y_center(l["bbox"]))
        total_bayar = self._extract_total_bayar(ordered)
        if total_bayar is not None:
            return total_bayar
        explicit_total = self._extract_explicit_jumlah_tagihan(ordered)
        if explicit_total is not None:
            return explicit_total
        anchored_total = self._extract_tagihan_anchor_total(ordered)
        if anchored_total is not None:
            return anchored_total

        strong_anchor_keywords = ["jumlah tagihan", "total tagihan", "total bayar", "total pembayaran", "grand total", "total"]
        weak_anchor_keywords = ["tagihan"]

        candidates: List[Tuple[int, float, List[float]]] = []
        for idx, line in enumerate(ordered):
            anchor_text = line["text"].lower()
            is_strong_anchor = any(k in anchor_text for k in strong_anchor_keywords)
            is_weak_anchor = any(k in anchor_text for k in weak_anchor_keywords)
            if not (is_strong_anchor or is_weak_anchor):
                continue

            anchor_conf = min(float(line.get("confidence", 0.0)), 1.0)
            local_amounts: List[Tuple[int, List[float], float]] = []
            for next_idx in range(idx, min(idx + 4, len(ordered))):
                next_line = ordered[next_idx]
                next_text = next_line["text"].lower()
                if any(token in next_text for token in BLOCKED_BILLING_TOKENS):
                    continue

                next_conf = min(float(next_line.get("confidence", 0.0)), 1.0)
                for amount in self._amounts_from_line(next_text):
                    if amount < MIN_AMOUNT or amount > MAX_VALID_AMOUNT:
                        continue
                    local_amounts.append((amount, next_line["bbox"], next_conf))

            if not local_amounts:
                continue

            # For explicit total/tagihan anchors, prefer the largest nearby amount
            # instead of nearest amount (avoids selecting admin fee lines).
            local_amounts.sort(key=lambda item: item[0], reverse=True)
            chosen_amount, chosen_bbox, chosen_conf = local_amounts[0]

            base = 0.76 if is_strong_anchor else 0.66
            score = base + ((anchor_conf + chosen_conf) / 2.0) * 0.18
            candidates.append((chosen_amount, score, chosen_bbox))

        if not candidates:
            return None

        candidates.sort(key=lambda item: (item[1], item[0]), reverse=True)
        amount, score, bbox = candidates[0]
        if score < 0.5:
            return None
        return {"total": amount, "confidence": round(min(score, 1.0), 4), "bbox": bbox}

    def _extract_tagihan_anchor_total(self, lines: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        ordered = sorted(lines, key=lambda l: y_center(l["bbox"]))
        candidates: List[Tuple[float, int, List[float]]] = []

        for idx, line in enumerate(ordered):
            anchor_text = line["text"].lower()
            if "tagihan" not in anchor_text:
                continue

            anchor_conf = min(float(line.get("confidence", 0.0)), 1.0)
            for near_idx in range(idx, min(idx + 4, len(ordered))):
                near_line = ordered[near_idx]
                near_text = near_line["text"].lower()
                if any(token in near_text for token in BLOCKED_BILLING_TOKENS):
                    continue

                near_conf = min(float(near_line.get("confidence", 0.0)), 1.0)
                distance_penalty = (near_idx - idx) * 0.05
                keyword_bonus = 0.0
                if "jumlah tagihan" in anchor_text or "jumlah tagihan" in near_text:
                    keyword_bonus += 0.16
                if "total bayar" in near_text or "total pembayaran" in near_text:
                    keyword_bonus += 0.08

                for amount in self._amounts_from_line(near_text):
                    if amount < MIN_AMOUNT or amount > MAX_VALID_AMOUNT:
                        continue
                    score = 0.76 + ((anchor_conf + near_conf) / 2.0) * 0.18 + keyword_bonus - distance_penalty
                    candidates.append((score, amount, near_line["bbox"]))

        if not candidates:
            return None

        candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
        best_score, best_amount, best_bbox = candidates[0]
        if best_score < 0.5:
            return None
        return {"total": best_amount, "confidence": round(min(best_score, 1.0), 4), "bbox": best_bbox}

    def _extract_total_bayar(self, lines: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        ordered = sorted(lines, key=lambda l: y_center(l["bbox"]))
        candidates: List[Tuple[float, int, List[float]]] = []

        for idx, line in enumerate(ordered):
            anchor_text = line["text"].lower().replace("0", "o")
            has_total_bayar = (
                "total bayar" in anchor_text
                or "total pembayaran" in anchor_text
                or "jumlah pembayaran" in anchor_text
            )
            has_jumlah_tagihan = "jumlah tagihan" in anchor_text
            has_total_tagihan = "total tagihan" in anchor_text

            if not has_total_bayar and "total" in anchor_text and idx + 1 < len(ordered):
                next_text = ordered[idx + 1]["text"].lower().replace("0", "o")
                if "bayar" in next_text or "pembayaran" in next_text:
                    has_total_bayar = True

            if not (has_total_bayar or has_jumlah_tagihan or has_total_tagihan):
                continue

            anchor_conf = min(float(line.get("confidence", 0.0)), 1.0)
            for near_idx in range(max(0, idx - 1), min(idx + 8, len(ordered))):
                near_line = ordered[near_idx]
                near_text_norm = near_line["text"].lower().replace("0", "o")
                near_text = near_line["text"].lower()
                if "total admin" in near_text_norm:
                    continue
                if any(token in near_text_norm for token in ["npwp", "resi", "telepon", "pelanggan", "tanggal", "jam"]):
                    continue

                near_conf = min(float(near_line.get("confidence", 0.0)), 1.0)
                distance_penalty = (near_idx - idx) * 0.03
                for amount in self._amounts_from_line(near_text):
                    if amount < 10_000 or amount > MAX_VALID_AMOUNT:
                        continue
                    keyword_bonus = 0.18 if has_total_bayar else 0.12
                    score = 0.78 + keyword_bonus + ((anchor_conf + near_conf) / 2.0) * 0.1 - abs(distance_penalty)
                    score += (amount / MAX_VALID_AMOUNT) * 0.12
                    candidates.append((score, amount, near_line["bbox"]))

        tagihan_values: List[Tuple[int, List[float], float]] = []
        admin_values: List[Tuple[int, List[float], float]] = []
        for idx, line in enumerate(ordered):
            text_norm = line["text"].lower().replace("0", "o")
            text = line["text"].lower()
            confidence = min(float(line.get("confidence", 0.0)), 1.0)

            if "jumlah tagihan" in text_norm or "total tagihan" in text_norm:
                local_amounts: List[Tuple[int, List[float], float]] = []
                for near_idx in range(idx, min(idx + 5, len(ordered))):
                    near_line = ordered[near_idx]
                    near_text = near_line["text"].lower()
                    near_conf = min(float(near_line.get("confidence", 0.0)), 1.0)
                    for amount in self._amounts_from_line(near_text):
                        if MIN_AMOUNT <= amount <= MAX_VALID_AMOUNT:
                            local_amounts.append((amount, near_line["bbox"], near_conf))
                if local_amounts:
                    best_amount, best_bbox, best_conf = sorted(local_amounts, key=lambda x: x[0], reverse=True)[0]
                    tagihan_values.append((best_amount, best_bbox, max(confidence, best_conf)))

            if "total admin" in text_norm:
                local_admin: List[Tuple[int, List[float], float]] = []
                for near_idx in range(idx, min(idx + 4, len(ordered))):
                    near_line = ordered[near_idx]
                    near_text = near_line["text"].lower()
                    near_conf = min(float(near_line.get("confidence", 0.0)), 1.0)
                    for amount in self._amounts_from_line(near_text):
                        if MIN_AMOUNT <= amount <= MAX_VALID_AMOUNT:
                            local_admin.append((amount, near_line["bbox"], near_conf))
                if local_admin:
                    best_amount, best_bbox, best_conf = sorted(local_admin, key=lambda x: x[0], reverse=True)[0]
                    admin_values.append((best_amount, best_bbox, max(confidence, best_conf)))

        if tagihan_values and admin_values:
            tagihan_amount, tagihan_bbox, tagihan_conf = sorted(tagihan_values, key=lambda x: x[0], reverse=True)[0]
            admin_amount, _admin_bbox, admin_conf = sorted(admin_values, key=lambda x: x[0], reverse=True)[0]
            combined = tagihan_amount + admin_amount
            if MIN_AMOUNT <= combined <= MAX_VALID_AMOUNT:
                combo_score = 0.95 + ((tagihan_conf + admin_conf) / 2.0) * 0.04
                candidates.append((combo_score, combined, tagihan_bbox))

        if not candidates:
            return None

        candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
        best_score, best_amount, best_bbox = candidates[0]
        if best_score < 0.5:
            return None
        return {"total": best_amount, "confidence": round(min(best_score, 1.0), 4), "bbox": best_bbox}

    def _extract_retail_v3_ranked(self, lines: List[Dict[str, Any]], page_height: int) -> Optional[Dict[str, Any]]:
        candidates: List[Tuple[int, float, List[float]]] = []
        keyword_candidates: List[Tuple[int, float, List[float]]] = []
        keyword_anchors: List[Tuple[float, List[float], float]] = []
        amount_lines: List[Tuple[int, float, List[float], float]] = []

        for line in lines:
            text = line["text"].lower()
            normalized = text.replace("0", "o")
            confidence = float(line.get("confidence", 0.0))
            yc = y_center(line["bbox"])
            is_bottom = yc > page_height * 0.6
            has_keyword = any(keyword in normalized for keyword in RETAIL_RANK_KEYWORDS)
            has_negative_context = any(token in text for token in V3_NEGATIVE_CONTEXT)

            if has_keyword and not has_negative_context:
                keyword_anchors.append((yc, line["bbox"], confidence))

            for amount in self._amounts_from_line(text):
                score = 0.0
                if has_keyword:
                    score += 0.4
                if is_bottom:
                    score += 0.2
                score += min(confidence, 1.0) * 0.2
                score += (amount / MAX_VALID_AMOUNT) * 0.2
                if has_negative_context:
                    score -= 0.3
                candidates.append((amount, score, line["bbox"]))
                amount_lines.append((amount, confidence, line["bbox"], yc))
                if has_keyword and not has_negative_context:
                    keyword_score = score + 0.1
                    keyword_candidates.append((amount, keyword_score, line["bbox"]))

        # Fallback: pair keyword-only anchors (e.g. "TOTAL") with nearest amount line below it.
        for anchor_y, _anchor_bbox, anchor_conf in keyword_anchors:
            best_match: Optional[Tuple[int, float, List[float], float]] = None
            best_distance = float("inf")
            for amount, amount_conf, amount_bbox, amount_y in amount_lines:
                vertical_distance = amount_y - anchor_y
                if vertical_distance < 0:
                    continue
                if vertical_distance > page_height * 0.22:
                    continue
                if vertical_distance < best_distance:
                    best_distance = vertical_distance
                    best_match = (amount, amount_conf, amount_bbox, amount_y)

            if best_match is not None:
                amount, amount_conf, amount_bbox, _ = best_match
                proximity_bonus = max(0.0, 0.15 - (best_distance / max(page_height, 1)) * 0.6)
                score = 0.45 + min((anchor_conf + amount_conf) / 2.0, 1.0) * 0.2 + (amount / MAX_VALID_AMOUNT) * 0.2 + proximity_bonus
                keyword_candidates.append((amount, score, amount_bbox))

        # Strong preference: if any keyword-anchored candidates exist,
        # use the best one first to keep bbox aligned with TOTAL context.
        if keyword_candidates:
            keyword_candidates.sort(key=lambda item: (item[1], item[0]), reverse=True)
            kw_amount, kw_score, kw_bbox = keyword_candidates[0]
            if kw_score >= (RETAIL_MIN_SCORE_THRESHOLD - 0.08):
                return {
                    "total": kw_amount,
                    "confidence": round(min(kw_score, 1.0), 4),
                    "bbox": kw_bbox,
                }

        if not candidates:
            return None

        candidates.sort(key=lambda item: item[1], reverse=True)
        best_amount, best_score, best_bbox = candidates[0]

        if best_score < RETAIL_MIN_SCORE_THRESHOLD:
            if not keyword_candidates:
                return None
            keyword_candidates.sort(key=lambda item: (item[1], item[0]), reverse=True)
            best_amount, best_score, best_bbox = keyword_candidates[0]

        if best_score < RETAIL_MIN_SCORE_THRESHOLD:
            return None

        return {"total": best_amount, "confidence": round(min(best_score, 1.0), 4), "bbox": best_bbox}

    def _extract_retail_secondary_total(
        self,
        lines: List[Dict[str, Any]],
        page_height: int,
        primary_amount: int,
    ) -> Optional[Dict[str, Any]]:
        candidates: List[Tuple[int, float, List[float]]] = []
        ordered_lines = sorted(lines, key=lambda l: y_center(l["bbox"]))

        for line in lines:
            text = line["text"].lower()
            normalized = text.replace("0", "o")
            confidence = float(line.get("confidence", 0.0))
            is_bottom = y_center(line["bbox"]) > page_height * 0.55
            has_keyword = any(keyword in normalized for keyword in RETAIL_RANK_KEYWORDS)
            has_negative_context = any(token in text for token in V3_NEGATIVE_CONTEXT)

            for amount in self._amounts_from_line(text):
                if amount == primary_amount:
                    continue
                score = 0.0
                if has_keyword:
                    score += 0.45
                if is_bottom:
                    score += 0.15
                score += min(confidence, 1.0) * 0.2
                score += (amount / MAX_VALID_AMOUNT) * 0.2
                if has_negative_context:
                    score -= 0.25
                candidates.append((amount, score, line["bbox"]))

        # Fallback: if keyword and amount are split across nearby lines,
        # pull amounts from the next few lines after a TOTAL anchor.
        for idx, line in enumerate(ordered_lines):
            text = line["text"].lower()
            normalized = text.replace("0", "o")
            if not any(keyword in normalized for keyword in RETAIL_RANK_KEYWORDS):
                continue
            if any(token in text for token in V3_NEGATIVE_CONTEXT):
                continue

            anchor_conf = float(line.get("confidence", 0.0))
            for next_idx in range(idx + 1, min(idx + 6, len(ordered_lines))):
                next_line = ordered_lines[next_idx]
                next_text = next_line["text"].lower()
                if any(token in next_text for token in V3_NEGATIVE_CONTEXT):
                    continue
                next_conf = float(next_line.get("confidence", 0.0))
                for amount in self._amounts_from_line(next_text):
                    if amount == primary_amount:
                        continue
                    distance_penalty = (next_idx - idx) * 0.03
                    score = 0.58 + min((anchor_conf + next_conf) / 2.0, 1.0) * 0.2 + (amount / MAX_VALID_AMOUNT) * 0.2 - distance_penalty
                    candidates.append((amount, score, next_line["bbox"]))

        if not candidates:
            return None

        candidates.sort(key=lambda item: (item[1], item[0]), reverse=True)
        best_amount, best_score, best_bbox = candidates[0]

        if best_score < 0.45:
            return None

        return {"total": best_amount, "confidence": round(min(best_score, 1.0), 4), "bbox": best_bbox}

    @staticmethod
    def _avg_conf(lines: List[Dict[str, Any]]) -> float:
        if not lines:
            return 0.0
        return sum(l["confidence"] for l in lines) / len(lines)

    @staticmethod
    def _max_currency_with_bbox(lines: List[Dict[str, Any]]) -> Optional[Tuple[int, List[float]]]:
        """Returns tuple of (max_amount, bbox) or None if no amounts found."""
        max_amount = None
        max_bbox = None
        for line in lines:
            line_amounts = OCRService._amounts_from_line(line["text"])
            if line_amounts:
                line_max = max(line_amounts)
                if max_amount is None or line_max > max_amount:
                    max_amount = line_max
                    max_bbox = line["bbox"]
        return (max_amount, max_bbox) if max_amount is not None else None

    @staticmethod
    def _amounts_from_line(text: str) -> List[int]:
        values: List[int] = []
        seen: set[int] = set()

        for match in AMOUNT_RE.finditer(text):
            value = parse_amount(match.group(1))
            if value is None:
                continue
            if value < MIN_AMOUNT or value > MAX_VALID_AMOUNT:
                continue
            if value not in seen:
                values.append(value)
                seen.add(value)

        # Fallback for OCR-noisy numeric runs that primary regex may miss.
        for raw_token in NOISY_AMOUNT_RE.findall(text):
            value = parse_amount(raw_token)
            if value is None:
                continue
            if value < MIN_AMOUNT or value > MAX_VALID_AMOUNT:
                continue
            if value not in seen:
                values.append(value)
                seen.add(value)
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
