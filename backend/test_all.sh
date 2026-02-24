#!/bin/bash
cd /app

echo "File 1 (expected 148840):"
timeout 60 /opt/venv/bin/python uploads/ocr-engine/smartopex-engine-v4.py --input uploads/receipts/receipts-1771858359604-106750587.pdf --json 2>&1 | python3 -c "import sys, json; d=json.load(sys.stdin); print('  grand_total:', d.get('grand_total'), '✓' if d.get('grand_total') == 148840 else '✗')"

echo ""
echo "File 2 (expected 66436):"
timeout 60 /opt/venv/bin/python uploads/ocr-engine/smartopex-engine-v4.py --input uploads/receipts/receipts-1771858359606-233381048.pdf --json 2>&1 | python3 -c "import sys, json; d=json.load(sys.stdin); print('  grand_total:', d.get('grand_total'), '✓' if d.get('grand_total') == 66436 else '✗')"

echo ""
echo "File 3 (expected 1354036):"
timeout 60 /opt/venv/bin/python uploads/ocr-engine/smartopex-engine-v4.py --input uploads/receipts/receipts-1771858359604-1195303.pdf --json 2>&1 | python3 -c "import sys, json; d=json.load(sys.stdin); print('  grand_total:', d.get('grand_total'), '✓' if d.get('grand_total') == 1354036 else '✗')"

echo ""
echo "File 4 (expected 98150):"
timeout 60 /opt/venv/bin/python uploads/ocr-engine/smartopex-engine-v4.py --input uploads/receipts/receipts-1771858359596-139357293.pdf --json 2>&1 | python3 -c "import sys, json; d=json.load(sys.stdin); print('  grand_total:', d.get('grand_total'), '✓' if d.get('grand_total') == 98150 else '✗')"
