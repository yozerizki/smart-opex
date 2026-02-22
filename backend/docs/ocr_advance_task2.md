SYSTEM GOAL

Build a production-ready OCR engine optimized for Indonesian receipts with:

Multi input support (image + PDF + multipage)

Max 2 receipts per page

Multi category handling

Robust total extraction

Confidence scoring

Handwritten vs printed adaptive processing

Return single grand total (sum of all receipts)

Target reliability: 85–90% across mixed receipt categories.

ARCHITECTURE REQUIREMENTS

Use this structure:

class OCRProcessor
class ReceiptClassifier
class ReceiptSegmenter
class TotalExtractor
class OCRService


Do NOT merge responsibilities.

1️⃣ OCRProcessor

Initialize PaddleOCR with:

PaddleOCR(
    use_angle_cls=True,
    lang="latin",
    use_gpu=False,
    show_log=False
)


Add:

Image resizing (max width 1600px)

Automatic contrast normalization

Optional handwritten preprocessing

Confidence filtering (discard text with confidence < 0.6)

Return structured output:

[
  {
    "text": "...",
    "confidence": 0.91,
    "bbox": [x1,y1,x2,y2,x3,y3,x4,y4]
  }
]

2️⃣ ReceiptClassifier

Do NOT rely only on keyword matching.

Implement hybrid classification using:

A. Keyword signals
B. Statistical heuristics

Heuristics to implement:

Average confidence score

Variance of bounding box height

Density of short text boxes

Ratio of numeric-only lines

Rules:

If:

avg_confidence < 0.75

bbox height variance high
→ classify as "handwritten"

Keyword based categories:

retail_printed

institutional_kuitansi

digital_payment

handwritten

unknown

Important:
DO NOT classify digital_payment only because "QR" or "QRIS" exists.
If document contains structured item list and subtotal/discount/service lines → treat as retail_printed even if payment method mentions QR.

3️⃣ ReceiptSegmenter (Multi Receipt Support)

Implement Y-axis clustering.

Steps:

Sort boxes by vertical center.

Detect large vertical gap.

If gap > 25% of page height → split into 2 groups.

Return 1 or 2 receipt groups.

Max split: 2 only.

If more detected → merge smallest cluster.

4️⃣ TotalExtractor (CORE LOGIC – MUST BE STRONG)

Implement multi-stage extraction:

STAGE 1 – Strong Keyword Match (fuzzy)

Match tolerant patterns:

total

t0tal

sub total

grand total

jumlah

total bayar

total pembayaran

Use regex tolerant matching.

If found:
Extract currency from same line.

STAGE 2 – Positional Reasoning

If no keyword found:

Find largest currency value located in bottom 40% of page.

Exclude values near:

"trx"

"id"

"no"

"ref"

phone numbers

STAGE 3 – Currency Filtering

Accept only values:

Between Rp1.000 and Rp100.000.000

Max 12 digits

Proper thousand separators

Normalize:

Remove dot separator

Convert to int

STAGE 4 – Confidence Scoring

Score based on:

Keyword match (+0.4)

Bottom location (+0.2)

Highest value (+0.2)

Confidence avg of nearby text (+0.2)

Return:
{
"total": 201025,
"confidence": 0.88
}

If confidence < 0.6 → return None

5️⃣ Handwritten Strategy

If classified as handwritten:

Apply adaptive threshold

Dilate image slightly

Lower OCR confidence threshold to 0.5

Skip positional heuristics (use max currency strategy)

6️⃣ OCRService

Workflow:

For each page:
preprocess
run OCR
classify
segment receipts (max 2)
extract total per receipt
Sum all totals
Return:

{
"grand_total": int,
"confidence": avg_confidence,
"receipt_count": int,
"category_detected": list
}

If no valid total found:
Return error message.

7️⃣ PDF Support

Use pdf2image to convert each page.

Normalize DPI to 300.

8️⃣ Defensive Programming

All functions must use try/except

Log internal steps

Never crash worker

9️⃣ IMPORTANT BUSINESS RULES

Ignore payment method labels like QR/QRIS if retail structure exists

If two receipts detected on one page → total each first → then sum

Always return single Rupiah integer

Never return float

10️⃣ CODE QUALITY

Use type hints

Use docstrings

Modular

Production readable

No print debugging

END OF SPEC.