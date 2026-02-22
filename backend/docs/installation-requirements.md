# Installation Requirements (Docker-Friendly)

This document lists required tools/libraries per service.

When building Docker images, prefer Debian/Ubuntu base images so required system
packages are available via `apt-get`.

## Backend API (NestJS)

- Node.js 20.x (LTS)
- npm or yarn
- Redis (queue)
- Environment variables:
  - REDIS_URL or REDIS_HOST + REDIS_PORT
  - DATABASE_URL (PostgreSQL)

## OCR Worker (PaddleOCR)

- Python 3.12 (venv recommended)
- Python packages (install with `pip -r scripts/ocr/requirements.txt`):
  - paddleocr
  - paddlepaddle
  - pdf2image
  - pillow
  - numpy
  - setuptools
- System tools for PDF OCR:
  - Poppler (`pdfinfo`, `pdftoppm`) for pdf2image
  - Debian/Ubuntu: `apt-get install -y poppler-utils`
  - Alpine (not recommended for PaddleOCR): `apk add poppler-utils`
- Environment variables:
  - OCR_PYTHON (path to venv python)
  - OCR_SCRIPT_PATH (optional override)
  - OCR_PROVIDER (default: paddle)
  - OCR_ENDPOINT / OCR_ENDPOINT_TOKEN (if OCR_PROVIDER=external)

## Frontend (Vite + React)

- Node.js 20.x (LTS)
- npm or yarn
- Environment variables (optional):
  - VITE_API_URL (defaults to http://localhost:3000)

## Database

- PostgreSQL 14+ (recommended 15+)
- Prisma migrations (run with `npx prisma migrate deploy` in production)
- Environment variables:
  - DATABASE_URL

## Redis

- Redis 6+ (recommended 7+)
- Used by BullMQ queue for OCR jobs
