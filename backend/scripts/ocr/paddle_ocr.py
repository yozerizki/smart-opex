#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
from typing import Any, Dict, List, Tuple

try:
    from paddleocr import PaddleOCR
except Exception as exc:
    print(f"Missing paddleocr dependency: {exc}", file=sys.stderr)
    raise

try:
    from PIL import Image
except Exception as exc:
    print(f"Missing pillow dependency: {exc}", file=sys.stderr)
    raise

try:
    from pdf2image import convert_from_path
except Exception as exc:
    convert_from_path = None

import numpy as np

POSITIVE_KEYWORDS = [
    "grand total",
    "total pembayaran",
    "total bayar",
    "total belanja",
    "total harga",
    "total",
    "jumlah",
    "dibayar",
    "bayar",
    "payment",
]

NEGATIVE_KEYWORDS = [
    "subtotal",
    "sub total",
    "tax",
    "ppn",
    "service",
    "diskon",
    "discount",
    "kembalian",
    "change",
    "admin",
    "biaya",
]

AMOUNT_RE = re.compile(
    r"(?:(?:rp|idr)\s*)?(\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)",
    re.IGNORECASE,
)

MAX_AMOUNT = 999_999_999


def parse_amount(raw: str) -> float:
    text = raw.lower().replace("rp", "").replace("idr", "")
    text = text.replace(" ", "").strip()
    if not text:
        return 0.0

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

    try:
        return float(text)
    except ValueError:
        return 0.0


def line_score(text: str, confidence: float) -> float:
    lower = text.lower()
    score = 0.0

    for kw in POSITIVE_KEYWORDS:
        if kw in lower:
            if kw == "grand total":
                score += 6
            elif kw.startswith("total"):
                score += 4
            else:
                score += 2

    if "rp" in lower or "idr" in lower:
        score += 2

    for kw in NEGATIVE_KEYWORDS:
        if kw in lower:
            score -= 3

    score += min(confidence * 2.0, 2.0)
    return score


def extract_candidates(ocr_result: List[Any]) -> List[Dict[str, Any]]:
    candidates = []
    for line in ocr_result:
        if not line or len(line) < 2:
            continue
        box = line[0]
        text = line[1][0]
        conf = float(line[1][1]) if len(line[1]) > 1 else 0.0

        if not text:
            continue

        for match in AMOUNT_RE.finditer(text):
            raw_amount = match.group(1)
            amount = parse_amount(raw_amount)
            if amount <= 0 or amount > MAX_AMOUNT:
                continue

            y_values = [pt[1] for pt in box]
            y_center = sum(y_values) / len(y_values)
            score = line_score(text, conf)

            candidates.append(
                {
                    "text": text,
                    "amount": amount,
                    "score": score,
                    "y": y_center,
                    "confidence": conf,
                }
            )
    return candidates


def normalize_result(result: Any) -> List[Any]:
    if not result:
        return []
    if len(result) == 1 and isinstance(result[0], list):
        if result[0] and isinstance(result[0][0], list) and len(result[0][0]) == 2:
            return result[0]
    return result


def select_totals(candidates: List[Dict[str, Any]], page_height: int) -> List[Dict[str, Any]]:
    if not candidates:
        return []

    candidates.sort(key=lambda c: c["y"])
    gap = max(80, int(page_height * 0.15))
    clusters: List[List[Dict[str, Any]]] = []
    current: List[Dict[str, Any]] = []
    last_y = None

    for cand in candidates:
        if last_y is None or (cand["y"] - last_y) <= gap:
            current.append(cand)
        else:
            clusters.append(current)
            current = [cand]
        last_y = cand["y"]

    if current:
        clusters.append(current)

    selected = []
    for cluster in clusters:
        cluster.sort(key=lambda c: (c["score"], c["amount"]), reverse=True)
        best = cluster[0]
        if best["score"] >= 2:
            selected.append(best)

    if not selected:
        candidates.sort(key=lambda c: (c["score"], c["amount"]), reverse=True)
        selected.append(candidates[0])

    return selected


def load_images(input_path: str) -> List[Image.Image]:
    ext = os.path.splitext(input_path)[1].lower()
    if ext == ".pdf":
        if convert_from_path is None:
            raise RuntimeError("pdf2image not installed for PDF processing")
        return convert_from_path(input_path, dpi=200)
    return [Image.open(input_path).convert("RGB")]


def run_ocr(images: List[Image.Image]) -> Dict[str, Any]:
    ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
    total_amount = 0.0
    found_any = False
    per_page = []
    raw_lines = []
    confidence_scores = []

    for idx, image in enumerate(images, start=1):
        np_img = np.array(image)
        result = ocr.ocr(np_img, cls=True)
        if not result:
            per_page.append({"page": idx, "amount": 0.0})
            continue
        normalized = normalize_result(result)

        candidates = extract_candidates(normalized)
        selected = select_totals(candidates, image.height)

        page_amount = sum(item["amount"] for item in selected)
        if selected and page_amount > 0:
            found_any = True
        total_amount += page_amount

        per_page.append({"page": idx, "amount": page_amount, "selected": selected})

        for line in normalized:
            if line and len(line) > 1:
                raw_lines.append(line[1][0])
                if len(line[1]) > 1:
                    confidence_scores.append(float(line[1][1]))

    avg_conf = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0.0

    amount_value = total_amount if found_any else None

    return {
        "amount": amount_value,
        "currency": "IDR",
        "per_page": per_page,
        "raw_text": "\n".join(raw_lines),
        "confidence": round(avg_conf, 4),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to input image or PDF")
    parser.add_argument("--json", action="store_true", help="Output JSON only")
    args = parser.parse_args()

    images = load_images(args.input)
    result = run_ocr(images)

    if args.json:
        print(json.dumps(result, ensure_ascii=True))
    else:
        print(json.dumps(result, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
