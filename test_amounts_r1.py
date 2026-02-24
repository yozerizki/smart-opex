#!/usr/bin/env python3
"""Test the amount collection logic for receipt #1 (IP Grati)"""

def y_center(bbox):
    return (bbox[1] + bbox[5]) / 2

def parse_amount(raw):
    """Parse IDR amount string to integer"""
    import re
    text = raw.lower().replace("rp", "").replace("idr", "").replace(" ", "").strip()
    if not text:
        return None
    
    text = re.sub(r"[^0-9.,]", "", text)
    if not text:
        return None
    
    # Identify decimal separator
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
    elif "," in text and "." not in text:
        parts = text.split(",")
        if len(parts) > 2:
            text = text.replace(",", "")
        else:
            right = parts[1] if len(parts) == 2 else ""
            if len(right) <= 2:
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

# Simulate the lines from receipt #1 (IP Grati)
# These simulate the structure after OCR text parsing
lines_data = [
    {"text": "Total", "bbox": [100, 1000, 500, 1020, 500, 1040, 100, 1040]},
    {"text": "Rp", "bbox": [600, 1000, 700, 1020, 700, 1040, 600, 1040]},
    {"text": "454.000,00  Rp", "bbox": [800, 1000, 1100, 1020, 1100, 1040, 800, 1040]},
    {"text": "199.500,00  Rp", "bbox": [1200, 1000, 1500, 1020, 1500, 1040, 1200, 1040]},
    {"text": "254.500,00", "bbox": [1600, 1000, 1800, 1020, 1800, 1040, 1600, 1040]},
]

ordered = lines_data
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
            print(f"  Skipping line {next_idx}: above baseline")
            continue
        if next_y - base_y > 120:
            print(f"  Breaking: line {next_idx} too far below")
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
    print(f"Expected for receipt #1: 199500")
    print(f"Match: {'YES ✓' if chosen == 199500 else f'NO ✗ (got {chosen})'}")
