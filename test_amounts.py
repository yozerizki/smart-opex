#!/usr/bin/env python3
"""Test the amount collection logic from paddle_ocr_v2.py"""

def y_center(bbox):
    return (bbox[1] + bbox[5]) / 2

# Simulate the lines from receipt #2 (Surabaya Billing)
# Line order after sorting by y-position
lines_data = [
    # ... many transaction lines ...
    # Here's the Total row section (y-coordinates are approximate)
    {"text": "Total", "bbox": [100, 1240, 500, 1260, 500, 1280, 100, 1280]},  # Total label at y~1260
    {"text": "Rp2.000.000,00Rp", "bbox": [600, 1240, 900, 1260, 900, 1280, 600, 1280]},  # Same y as label
    {"text": "4.082.202,00-Rp2.082.202,00", "bbox": [1000, 1240, 1300, 1260, 1300, 1280, 1000, 1280]},  # Same row
    # Saldo would be in another line further right
]

def parse_amount(raw):
    """Parse IDR amount string to integer"""
    import re
    text = raw.lower().replace("rp", "").replace("idr", "").replace(" ", "").strip()
    if not text:
        return None
    
    text = re.sub(r"[^0-9.,]", "", text)
    if not text:
        return None
    
    # Identify decimal separator: if comma is right-most with 2 digits, it's decimal
    if "," in text and "." in text:
        last_comma = text.rfind(",")
        last_dot = text.rfind(".")
        if last_comma > last_dot:  # comma is rightmost -> comma is decimal separator
            text = text.replace(".", "").replace(",", ".")
        else:  # dot is rightmost -> use dot, remove comma
            text = text.replace(",", "")
    elif "." in text and "," not in text:
        parts = text.split(".")
        if len(parts) > 2:  # e.g. "1.000.000" -> 1000000
            text = text.replace(".", "")
    elif "," in text and "." not in text:
        parts = text.split(",")
        if len(parts) > 2:  # e.g. "1,000,000" -> 1000000
            text = text.replace(",", "")
        else:
            right = parts[1] if len(parts) == 2 else ""
            if len(right) <= 2:  # e.g. "10,50" -> decimal
                text = text.replace(",", ".")
    
    try:
        return int(float(text))
    except:
        return None

def _amounts_from_line(text):
    """Parse amounts from a text line"""
    import re
    amounts = []
    seen = set()
    
    # Match IDR amounts like: Rp2.000.000,00 or Rp4.082.202,00-Rp2.082.202,00
    pattern = re.compile(
        r"(?:(?:rp|idr)\s*)?(\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)",
        re.IGNORECASE,
    )
    
    for match in pattern.finditer(text):
        value = parse_amount(match.group(1))
        if value and value >= 10000 and value <= 9999999999 and value not in seen:
            amounts.append(value)
            seen.add(value)
    
    return amounts

# Simulate Strategy A2 extraction
ordered = lines_data  # Already sorted by y
total_label_idx = None
for idx, line in enumerate(ordered):
    if "total" in line["text"].lower():
        total_label_idx = idx
        break

if total_label_idx is not None:
    base_y = y_center(ordered[total_label_idx]["bbox"])
    collected_amounts = []
    collected_lines_text = []
    
    # NEW Logic: Only next 3 lines, max 120px distance
    for next_idx in range(total_label_idx + 1, min(total_label_idx + 4, len(ordered))):
        next_line = ordered[next_idx]
        next_y = y_center(next_line["bbox"])
        
        if next_y + 5 < base_y:
            print(f"  Skipping line {next_idx}: above baseline (y={next_y} vs base={base_y})")
            continue
        if next_y - base_y > 120:
            print(f"  Breaking: line {next_idx} too far below (delta={next_y - base_y})")
            break
        
        next_amounts = _amounts_from_line(next_line["text"].lower())
        if next_amounts:
            collected_amounts.extend(next_amounts)
            collected_lines_text.append(f"'{next_line['text'][:40]}'→{next_amounts}")
            print(f"  Line {next_idx}: '{next_line['text']}' → amounts={next_amounts}")
    
    # Selection logic
    if len(collected_amounts) >= 3:
        chosen = collected_amounts[1]
        print(f"✓ Selected collected[1]={chosen} from array of {len(collected_amounts)}: {collected_amounts}")
    elif len(collected_amounts) == 2:
        chosen = min(collected_amounts)
        print(f"✓ Selected min={chosen} from 2-element array: {collected_amounts}")
    elif len(collected_amounts) == 1:
        chosen = collected_amounts[0]
        print(f"✓ Selected single element: {chosen}")
    else:
        chosen = None
        print(f"✗ No amounts collected")
    
    print(f"\nFinal selected amount: {chosen}")
    print(f"Expected for receipt #2: 4082202")
    print(f"Match: {'YES ✓' if chosen == 4082202 else 'NO ✗'}")
