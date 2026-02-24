import re
from paddle_ocr_v3 import OCRService, y_center

service = OCRService()
files = [
    "uploads/receipts/receipts-1771858359604-106750587.pdf",
    "uploads/receipts/receipts-1771858359606-233381048.pdf",
    "uploads/receipts/receipts-1771858359596-139357293.pdf",
]

for path in files:
    pages = service._load_pages(path)
    image = pages[0]
    lines = service.processor.run(image, handwritten=False, conf_threshold=0.35)
    lines = sorted(lines, key=lambda line: y_center(line["bbox"]))

    print(f"\n=== {path} ===")
    for idx, line in enumerate(lines):
        text = line["text"]
        lower = text.lower()
        amounts = service._amounts_from_line(lower)
        has_keyword = any(key in lower for key in ["tagihan", "total", "bayar", "admin", "jumlah"])
        if has_keyword or amounts:
            print(f"{idx:03d} y={y_center(line['bbox']):7.1f} text={text!r} amts={amounts}")

    result = service.process(path)
    print("RESULT:", result.get("grand_total"), result.get("category_detected"), result.get("error"))
