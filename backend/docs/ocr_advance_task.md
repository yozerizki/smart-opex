# TASK: Create Improved OCR Engine (paddle_ocr_v2.py)

We already have an OCR engine in `paddle_ocr.py`.  
DO NOT MODIFY that file.

Create a new file:

    paddle_ocr_v2.py

This new version must be more robust and document-aware.

---

## 🎯 GOAL

Build an improved OCR engine that:

- Accepts image or PDF input
- Extracts a single grand total amount (IDR)
- Supports multi-page documents
- Supports up to 2 receipts per page
- Detects document type before applying extraction strategy
- Returns confidence and needs_review flag

---

## 🧠 ARCHITECTURE REQUIREMENTS

Implement 2-stage pipeline:

### Stage 1 — OCR + Document Profiling
- Run PaddleOCR
- Collect all raw text lines
- Compute average OCR confidence
- Detect document type using contextual scoring (NOT single keyword trigger)

Supported document types:

- printed_receipt
- handwritten_receipt
- qris_or_transfer
- institutional_receipt
- simple_proof

DO NOT classify as qris_or_transfer only because of "QR" or "QRIS".
Use contextual multi-signal scoring.

---

### Stage 2 — Category-Specific Extraction Strategy

Extraction behavior must differ depending on document type.

#### printed_receipt
- Penalize subtotal, tax, service, discount
- Prefer "total", "grand total"
- Prefer bottom-position values
- Cluster vertically (for multiple receipts)

#### qris_or_transfer
- Prefer largest amount
- Add bonus for bounding box area (larger font)
- Add center-position bonus
- Ignore retail-specific negative keywords

#### institutional_receipt
- Prefer amount near keyword "sebesar"
- Ignore retail tax/service logic

#### handwritten_receipt
- Ignore keyword dependency
- Prefer largest reasonable amount
- Penalize very small amounts (< 10,000)
- Trigger needs_review more easily

#### simple_proof
- If only one amount → select it
- If multiple → select largest

---

## 📦 TECHNICAL REQUIREMENTS

1. Use PaddleOCR
2. Instantiate PaddleOCR ONLY ONCE (persistent instance)
3. Support PDF via pdf2image
4. Add bounding box area calculation for scoring
5. Implement candidate scoring system
6. Add MAX_AMOUNT guard (e.g., 999,999,999)
7. Return structured JSON

---

## 📤 RETURN FORMAT

Return JSON like:

{
  "amount": <float or null>,
  "currency": "IDR",
  "document_type": "<detected_type>",
  "confidence": <float>,
  "needs_review": <bool>,
  "per_page": [...],
  "raw_text": "..."
}

---

## 🛑 IMPORTANT

- Do NOT modify paddle_ocr.py
- Create paddle_ocr_v2.py
- Code must be production-ready
- Avoid overly complex ML models
- Use heuristic + scoring approach
- Keep it modular and readable

---

## ⚙ CLI SUPPORT

Support:

    python paddle_ocr_v2.py --input path/to/file --json

---

Focus on robustness and maintainability.
Avoid over-engineering.
Prioritize clarity and scoring logic.
