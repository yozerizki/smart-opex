import sys
import importlib.util
spec = importlib.util.spec_from_file_location('ocr', '/app/uploads/ocr-engine/smartopex-engine-v4.py')
ocr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ocr)

svc = ocr.OCRService()
path = 'uploads/receipts/receipts-1771858359604-106750587.pdf'
pages = svc._load_pages(path)
img = pages[0]
lines = svc.processor.run(img, handwritten=False, conf_threshold=0.6)
ordered = sorted(lines, key=lambda l: ocr.y_center(l['bbox']))

print('=== All lines with amounts ===')
for idx, line in enumerate(ordered):
    text = line['text']
    text_lower = text.lower()
    amounts = ocr.OCRService._amounts_from_line(text_lower)
    if amounts or any(k in text_lower for k in ['total', 'bayar', 'tagihan', 'admin', 'jumlah']):
        print('[{}] text={!r} amounts={}'.format(idx, text, amounts))

print('\n=== Simulating _extract_total_bayar logic ===')
candidates = []
for idx, line in enumerate(ordered):
    anchor_text = line['text'].lower().replace('0', 'o')
    has_total_bayar = (
        'total bayar' in anchor_text
        or 'total pembayaran' in anchor_text
        or 'jumlah pembayaran' in anchor_text
    )
    has_jumlah_tagihan = 'jumlah tagihan' in anchor_text
    has_total_tagihan = 'total tagihan' in anchor_text

    if not (has_total_bayar or has_jumlah_tagihan or has_total_tagihan):
        continue
    
    print('\n[{}] ANCHOR: {!r}'.format(idx, line['text']))
    print('  has_total_bayar={}, has_jumlah_tagihan={}, has_total_tagihan={}'.format(
        has_total_bayar, has_jumlah_tagihan, has_total_tagihan
    ))
    
    anchor_conf = min(float(line.get('confidence', 0.0)), 1.0)
    for near_idx in range(max(0, idx - 1), min(idx + 8, len(ordered))):
        near_line = ordered[near_idx]
        near_text = near_line['text'].lower().replace('0', 'o')
        if 'total admin' in near_text:
            continue
        if any(token in near_text for token in ['npwp', 'resi', 'telepon', 'pelanggan', 'tanggal', 'jam']):
            continue

        near_conf = min(float(near_line.get('confidence', 0.0)), 1.0)
        distance_penalty = (near_idx - idx) * 0.03
        amounts = ocr.OCRService._amounts_from_line(near_text)
        for amount in amounts:
            if amount < 10_000 or amount > 10_000_000:
                continue
            keyword_bonus = 0.18 if has_total_bayar else 0.12
            score = 0.78 + keyword_bonus + ((anchor_conf + near_conf) / 2.0) * 0.1 - abs(distance_penalty)
            score += (amount / 10_000_000) * 0.12
            candidates.append((score, amount, near_line['bbox'], near_idx))
            print('  [{}] near={!r} amt={} score={:.4f} distance_penalty={:.4f}'.format(
                near_idx, near_line['text'], amount, score, distance_penalty
            ))

if candidates:
    candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
    print('\n=== Top 5 candidates ===')
    for i, (score, amount, bbox, near_idx) in enumerate(candidates[:5]):
        print('[{}] score={:.4f} amount={} near_idx={}'.format(i, score, amount, near_idx))
    print('\n=== Selected candidate ===')
    best_score, best_amount, best_bbox, near_idx = candidates[0]
    print('amount={}, score={:.4f}, near_idx={}'.format(best_amount, best_score, near_idx))
else:
    print('\n=== No candidates found ===')
