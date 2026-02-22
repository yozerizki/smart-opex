# Document and OCR Rules – Smart OPEX

## Supported Document Types
- PDF (multi-page allowed)

## Page Rules
- One page should contain one invoice.
- Maximum two invoices per page are allowed only if visual separation is clear.
- Documents violating these rules will be marked as "PERLU_REVIEW".

## Document Categories
Users must select one of the following categories:
1. Handwritten scan
2. Printed scan
3. Digital screenshot (m-banking, e-commerce, digital receipt)

The selected category determines the OCR method used.

## OCR Scope
- The system only reads the TOTAL amount per invoice.
- Item-level details are not processed.
