#!/usr/bin/env python3
"""Dummy OCR engine that returns fixed 10000 for all receipts."""
import argparse
import json
import sys
from typing import Any, Dict


def process_dummy(input_path: str) -> Dict[str, Any]:
    """Return a fixed OCR result with grand_total=10000 for any input."""
    return {
        "grand_total": 10000,
        "currency": "IDR",
        "confidence": 1.0,
        "receipt_count": 1,
        "category_detected": ["dummy"],
        "per_page": [
            {
                "page": 1,
                "page_total": 10000,
                "receipt_count": 1,
                "receipts": [
                    {
                        "total": 10000,
                        "confidence": 1.0,
                    }
                ],
                "categories": ["dummy"],
                "avg_confidence": 1.0,
                "raw_text": ["DUMMY OCR - Fixed 10000"],
            }
        ],
        "raw_text": "DUMMY OCR - Fixed 10000",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Dummy OCR engine for demo")
    parser.add_argument("--input", required=True, help="Path to input file (ignored in dummy mode)")
    parser.add_argument("--json", action="store_true", help="Output JSON only")
    args = parser.parse_args()

    result = process_dummy(args.input)

    if args.json:
        print(json.dumps(result, ensure_ascii=True))
    else:
        print(json.dumps(result, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
