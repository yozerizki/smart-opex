#!/bin/bash
cd /app
echo "File 1 (expected 148840):"
/opt/venv/bin/python uploads/ocr-engine/smartopex-engine-v4.py --input uploads/receipts/receipts-1771858359604-106750587.pdf --json | grep -oE '"grand_total":[0-9]+' | head -1

echo ""
echo "File 2 (expected 66436):"
/opt/venv/bin/python uploads/ocr-engine/smartopex-engine-v4.py --input uploads/receipts/receipts-1771858359606-233381048.pdf --json | grep -oE '"grand_total":[0-9]+' | head -1

echo ""
echo "File 3 (expected 1354036):"
/opt/venv/bin/python uploads/ocr-engine/smartopex-engine-v4.py --input uploads/receipts/receipts-1771858359604-1195303.pdf --json | grep -oE '"grand_total":[0-9]+' | head -1

echo ""
echo "File 4 (expected 98150):"
/opt/venv/bin/python uploads/ocr-engine/smartopex-engine-v4.py --input uploads/receipts/receipts-1771858359596-139357293.pdf --json | grep -oE '"grand_total":[0-9]+' | head -1
