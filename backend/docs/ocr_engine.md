# OCR Engine (PaddleOCR)

## Overview
- OCR runs asynchronously via a Redis-backed queue (BullMQ).
- Each uploaded receipt is processed into a single detected total (IDR).
- Multi-page PDFs are handled; totals are summed per page and aggregated.

## Runtime Components
1. API server (enqueue OCR jobs)
2. OCR worker (process jobs and update totals)
3. Redis (queue backend)

## Environment Variables
- `REDIS_URL` or `REDIS_HOST`/`REDIS_PORT`
- `OCR_PYTHON` (optional, default: `python3`)
- `OCR_SCRIPT_PATH` (optional, default: `scripts/ocr/paddle_ocr.py`)

## Python Dependencies
Install requirements for OCR worker:

```
pip install -r scripts/ocr/requirements.txt
```

For PDF support, `pdf2image` requires Poppler installed on the host.
