#!/usr/bin/env python3
"""
SmartOPEX OCR Engine v3.0
Production-grade OCR engine for Indonesian receipts.

Design goals:
- Ranking-based total extraction
- Multi-category handling
- Multi-receipt per page (max 2)
- Robust scoring system
- CPU-only environment
- Async worker safe
"""

import os
import re
import json
import logging
from typing import List, Dict, Any, Optional, Tuple

import numpy as np

from PIL import Image, ImageOps
import cv2

from paddleocr import PaddleOCR

try:
    from pdf2image import convert_from_path
except Exception:
    convert_from_path = None


# ------------------------------
# CONFIGURATION
# ------------------------------

MIN_AMOUNT = 1_000
MAX_AMOUNT = 100_000_000
MAX_DIGITS = 12

TOTAL_KEYWORDS = [
    "total",
    "t0tal",
    "grand total",
    "jumlah",
    "total bayar",
    "total pembayaran",
]

NEGATIVE_CONTEXT = [
    "trx",
    "id",
    "ref",
    "no ",
    "saldo",
    "cashback",
    "admin",
    "biaya",
    "fee",
]

RETAIL_HINTS = ["subtotal", "diskon", "service", "ppn", "tax"]
INSTITUTIONAL_HINTS = ["kwitansi", "invoice", "faktur", "terbilang", "sebesar"]
PAYMENT_HINTS = ["transfer", "bank", "rekening", "virtual account", "va", "qris"]

AMOUNT_REGEX = re.compile(
    r"(?:(?:rp|idr)\s*)?(\d{1,3}(?:[.,\s]\d{3})+|\d+)",
    re.IGNORECASE,
)

logging.basicConfig(level=logging.INFO)
LOG = logging.getLogger("ocr_v3")


# ------------------------------
# UTILITY
# ------------------------------

def parse_amount(text: str) -> Optional[int]:
    raw = text.lower().replace("rp", "").replace("idr", "")
    raw = raw.replace(" ", "").strip()
    raw = raw.replace(".", "").replace(",", "")
    if not raw.isdigit():
        return None
    value = int(raw)
    if value < MIN_AMOUNT or value > MAX_AMOUNT:
        return None
    if len(str(value)) > MAX_DIGITS:
        return None
    return value


def y_center(bbox: List[float]) -> float:
    ys = bbox[1::2]
    return sum(ys) / len(ys)


def bbox_height(bbox: List[float]) -> float:
    ys = bbox[1::2]
    return max(ys) - min(ys)


# ------------------------------
# OCR PROCESSOR
# ------------------------------

class OCRProcessor:

    def __init__(self):
        self.ocr = PaddleOCR(
            use_angle_cls=True,
            lang="latin",
            use_gpu=False,
            show_log=False
        )

    def preprocess(self, image: Image.Image, handwritten=False):
        image = image.convert("RGB")

        if image.width > 1600:
            ratio = 1600 / image.width
            image = image.resize((1600, int(image.height * ratio)))

        image = ImageOps.autocontrast(image)

        if handwritten:
            gray = np.array(image.convert("L"))
            blur = cv2.GaussianBlur(gray, (5, 5), 0)
            thresh = cv2.adaptiveThreshold(
                blur,
                255,
                cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv2.THRESH_BINARY,
                25,
                15
            )
            kernel = np.ones((2, 2), np.uint8)
            thresh = cv2.dilate(thresh, kernel, iterations=1)
            image = Image.fromarray(thresh).convert("RGB")

        return image

    def run(self, image: Image.Image, conf_threshold=0.6) -> List[Dict]:
        try:
            np_img = np.array(image)
            result = self.ocr.ocr(np_img, cls=True)
        except Exception as e:
            LOG.warning(f"OCR failed: {e}")
            return []

        lines = []
        if not result:
            return lines

        if len(result) == 1:
            result = result[0]

        for line in result:
            box, (text, conf) = line
            if conf < conf_threshold:
                continue
            flat_box = [c for point in box for c in point]
            lines.append({
                "text": text,
                "confidence": float(conf),
                "bbox": flat_box
            })

        return lines


# ------------------------------
# CLASSIFIER
# ------------------------------

class ReceiptClassifier:

    def classify(self, lines: List[Dict]) -> str:
        if not lines:
            return "unknown"

        texts = [l["text"].lower() for l in lines]
        combined = "\n".join(texts)

        avg_conf = sum(l["confidence"] for l in lines) / len(lines)
        heights = [bbox_height(l["bbox"]) for l in lines]
        var_height = np.var(heights)

        retail_score = sum(h in combined for h in RETAIL_HINTS)
        inst_score = sum(h in combined for h in INSTITUTIONAL_HINTS)
        pay_score = sum(h in combined for h in PAYMENT_HINTS)

        if avg_conf < 0.75 and var_height > 200:
            return "handwritten"

        if retail_score >= 2:
            return "retail"

        if inst_score >= 1:
            return "institutional"

        if pay_score >= 2 and retail_score == 0:
            return "digital"

        return "unknown"


# ------------------------------
# SEGMENTER
# ------------------------------

class ReceiptSegmenter:

    def segment(self, lines: List[Dict], page_height: int):
        if not lines:
            return []

        lines_sorted = sorted(lines, key=lambda x: y_center(x["bbox"]))
        centers = [y_center(l["bbox"]) for l in lines_sorted]

        gaps = []
        for i in range(1, len(centers)):
            gaps.append(centers[i] - centers[i - 1])

        if not gaps:
            return [lines_sorted]

        max_gap = max(gaps)
        idx = gaps.index(max_gap) + 1

        if max_gap > page_height * 0.25:
            group1 = lines_sorted[:idx]
            group2 = lines_sorted[idx:]

            if len(group1) < 5 or len(group2) < 5:
                return [lines_sorted]

            return [group1, group2]

        return [lines_sorted]


# ------------------------------
# TOTAL EXTRACTOR (RANKING BASED)
# ------------------------------

class TotalExtractor:

    def extract(self, lines: List[Dict], page_height: int):
        candidates = []

        for line in lines:
            text = line["text"].lower()
            amounts = self._extract_amounts(text)

            for amount in amounts:
                score = 0.0

                # Keyword boost
                if any(k in text.replace("0", "o") for k in TOTAL_KEYWORDS):
                    score += 0.4

                # Position boost (soft)
                if y_center(line["bbox"]) > page_height * 0.6:
                    score += 0.2

                # Confidence boost
                score += min(line["confidence"], 1.0) * 0.2

                # Largest value preference
                score += (amount / MAX_AMOUNT) * 0.2

                # Negative penalty
                if any(n in text for n in NEGATIVE_CONTEXT):
                    score -= 0.3

                candidates.append((amount, score))

        if not candidates:
            return None

        candidates.sort(key=lambda x: x[1], reverse=True)
        best_amount, best_score = candidates[0]

        if best_score < 0.5:
            return None

        return {
            "total": best_amount,
            "confidence": round(min(best_score, 1.0), 4)
        }

    def _extract_amounts(self, text: str):
        values = []
        for match in AMOUNT_REGEX.finditer(text):
            val = parse_amount(match.group(1))
            if val:
                values.append(val)
        return values


# ------------------------------
# SERVICE
# ------------------------------

class OCRService:

    def __init__(self):
        self.processor = OCRProcessor()
        self.classifier = ReceiptClassifier()
        self.segmenter = ReceiptSegmenter()
        self.extractor = TotalExtractor()

    def process(self, input_path: str) -> Dict[str, Any]:
        pages = self._load_pages(input_path)
        if not pages:
            return {"error": "No pages detected", "grand_total": None}

        grand_total = 0
        total_conf = []
        receipt_count = 0
        categories = []

        for page in pages:
            result = self._process_page(page)
            if result:
                grand_total += result["total"]
                total_conf.append(result["confidence"])
                receipt_count += result["receipt_count"]
                categories.extend(result["categories"])

        if grand_total == 0:
            return {
                "grand_total": None,
                "confidence": 0.0,
                "receipt_count": 0,
                "categories": categories,
                "error": "No valid total found"
            }

        return {
            "grand_total": grand_total,
            "confidence": round(sum(total_conf) / len(total_conf), 4),
            "receipt_count": receipt_count,
            "categories": list(set(categories))
        }

    def _process_page(self, image: Image.Image):
        lines = self.processor.run(image, 0.6)
        category = self.classifier.classify(lines)

        if category == "handwritten":
            image = self.processor.preprocess(image, handwritten=True)
            lines = self.processor.run(image, 0.5)

        groups = self.segmenter.segment(lines, image.height)

        totals = []
        for group in groups[:2]:
            result = self.extractor.extract(group, image.height)
            if result:
                totals.append(result)

        if not totals:
            return None

        return {
            "total": sum(t["total"] for t in totals),
            "confidence": sum(t["confidence"] for t in totals) / len(totals),
            "receipt_count": len(totals),
            "categories": [category]
        }

    def _load_pages(self, path: str):
        ext = os.path.splitext(path)[1].lower()
        if ext == ".pdf":
            if not convert_from_path:
                return []
            return convert_from_path(path, dpi=300)
        return [Image.open(path)]


# ------------------------------
# CLI
# ------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    service = OCRService()
    result = service.process(args.input)

    if args.json:
        print(json.dumps(result))
    else:
        print(json.dumps(result, indent=2))
