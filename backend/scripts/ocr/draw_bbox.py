#!/usr/bin/env python3
"""
Draw bounding boxes on receipt images for visualization.
"""
import argparse
import json
import os
import sys
from typing import Dict, List, Optional
from PIL import Image, ImageDraw

try:
    from pdf2image import convert_from_path
except Exception:
    convert_from_path = None


def _normalize_bbox_payload(raw_bboxes: List) -> List[Dict[str, object]]:
    normalized: List[Dict[str, object]] = []
    for item in raw_bboxes:
        if isinstance(item, list):
            if len(item) == 8:
                normalized.append({"bbox": item, "page": 1})
            continue

        if isinstance(item, dict):
            bbox = item.get("bbox")
            if not isinstance(bbox, list) or len(bbox) != 8:
                continue
            page = item.get("page", 1)
            try:
                page_num = int(page)
            except Exception:
                page_num = 1
            if page_num < 1:
                page_num = 1
            normalized.append({"bbox": bbox, "page": page_num})

    return normalized


def _draw_on_image(
    image: Image.Image,
    bboxes: List[List[float]],
    box_color: str,
    line_width: int,
) -> Image.Image:
    draw = ImageDraw.Draw(image)
    for bbox in bboxes:
        if len(bbox) != 8:
            continue
        points = [
            (bbox[0], bbox[1]),
            (bbox[2], bbox[3]),
            (bbox[4], bbox[5]),
            (bbox[6], bbox[7]),
        ]
        draw.polygon(points, outline=box_color, width=line_width)
    return image


def draw_bboxes(
    image_path: str,
    bboxes: List,
    output_path: str,
    box_color: str = "red",
    line_width: int = 3,
) -> None:
    """
    Draw bounding boxes on an image.
    
    Args:
        image_path: Path to the input image
        bboxes: List of bounding boxes, each as [x1, y1, x2, y2, x3, y3, x4, y4]
        output_path: Path to save the annotated image
        box_color: Color of the bounding box (default: red)
        line_width: Width of the bounding box lines (default: 3)
    """
    try:
        normalized = _normalize_bbox_payload(bboxes)
        ext = os.path.splitext(image_path)[1].lower()
        if ext == ".pdf":
            if convert_from_path is None:
                raise RuntimeError("pdf2image is not available to read PDF files")
            pages = convert_from_path(image_path, dpi=300)
            if not pages:
                raise RuntimeError("No pages found in PDF")

            annotated_pages: List[Image.Image] = []
            for idx, page in enumerate(pages, start=1):
                page_image = page.convert("RGB")
                page_bboxes = [entry["bbox"] for entry in normalized if int(entry.get("page", 1)) == idx]
                annotated_pages.append(_draw_on_image(page_image, page_bboxes, box_color, line_width))

            if not annotated_pages:
                raise RuntimeError("No pages available to annotate")

            first_page = annotated_pages[0]
            rest_pages = annotated_pages[1:]
            first_page.save(output_path, save_all=True, append_images=rest_pages, format="PDF")
        else:
            image = Image.open(image_path).convert("RGB")

            image_bboxes = [entry["bbox"] for entry in normalized]
            image = _draw_on_image(image, image_bboxes, box_color, line_width)
            image.save(output_path)
        print(f"Annotated image saved to {output_path}")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Draw bounding boxes on receipt images"
    )
    parser.add_argument("--input", required=True, help="Path to input image")
    parser.add_argument("--output", required=True, help="Path to output image")
    parser.add_argument(
        "--bboxes",
        required=True,
        help="JSON array of bounding boxes [[x1,y1,x2,y2,x3,y3,x4,y4], ...]",
    )
    parser.add_argument("--color", default="red", help="Box color (default: red)")
    parser.add_argument(
        "--width", type=int, default=3, help="Line width (default: 3)"
    )
    
    args = parser.parse_args()
    
    try:
        bboxes = json.loads(args.bboxes)
        if not isinstance(bboxes, list):
            raise ValueError("bboxes must be a JSON array")
    except json.JSONDecodeError as e:
        print(f"Error parsing bboxes JSON: {e}", file=sys.stderr)
        sys.exit(1)
    
    draw_bboxes(args.input, bboxes, args.output, args.color, args.width)


if __name__ == "__main__":
    main()
