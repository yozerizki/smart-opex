#!/bin/bash
cd /app

echo "Testing File 1 (expected 148840):"
timeout 60 /opt/venv/bin/python uploads/ocr-engine/smartopex-engine-v4.py --input uploads/receipts/receipts-1771858359604-106750587.pdf --json 2>&1 | python3 -c "import sys, json; d=json.load(sys.stdin); print('grand_total:', d.get('grand_total'))" || echo "ERROR or TIMEOUT"

echo ""
echo "Testing File 4 (expected 98150):"
timeout 60 /opt/venv/bin/python uploads/ocr-engine/smartopex-engine-v4.py --input uploads/receipts/receipts-1771858359596-139357293.pdf --json 2>&1 | python3 -c "import sys, json; d=json.load(sys.stdin); print('grand_total:', d.get('grand_total'))" || echo "ERROR or TIMEOUT"
