# MULTI-RECEIPT UPLOAD & OCR AGGREGATION SPECIFICATION
SmartOPEX System Enhancement

---

# 1. OBJECTIVE

The system MUST replace the existing single-receipt upload mechanism with a multi-receipt architecture.

Each `opex_item` (kegiatan) MUST support:

- Minimum: 1 receipt
- Maximum: 10 receipts

The field `hasil_deteksi_ai` MUST represent the SUM of all OCR-detected totals from all associated receipts.

This field MUST NOT be manually editable.

---

# 2. DATABASE STRUCTURE

## 2.1 New Table: `opex_receipts`

The following table MUST be created:

| Column Name        | Type              | Constraints |
|-------------------|-------------------|-------------|
| id                | serial (PK)       | Primary Key |
| opex_item_id      | integer           | FK → opex_items.id (ON DELETE CASCADE) |
| file_path         | string            | NOT NULL |
| ocr_detected_total| numeric(15,2)     | Nullable |
| created_at        | timestamp         | NOT NULL |

### Rules:

- One `opex_item` MAY have multiple `opex_receipts`.
- Maximum receipts per `opex_item` = 10.
- Deleting an `opex_item` MUST delete all related receipts (CASCADE).

---

## 2.2 Update Existing `opex_items`

If the table currently contains:

- A single receipt file column → REMOVE it.
- A single OCR total column → REMOVE or STOP USING it.

The system MUST NOT:

- Store multiple file paths inside one column.
- Store JSON arrays of file paths inside `opex_items`.

Receipts MUST be normalized using `opex_receipts`.

---

# 3. BUSINESS RULES

## 3.1 Receipt Upload Validation

When creating or editing an `opex_item`:

- At least 1 receipt MUST be uploaded.
- No more than 10 receipts are allowed.
- If receipts > 10 → return **400 Bad Request**.
- If receipts = 0 → reject request.

---

## 3.2 OCR Processing Rules

For EACH uploaded receipt:

1. Execute OCR process.
2. Extract the total amount from the receipt.
3. Store the extracted value in:
   `opex_receipts.ocr_detected_total`

If OCR fails:
- Store `NULL` in `ocr_detected_total`.

---

# 4. AI DETECTION AGGREGATION LOGIC

The field:

```
hasil_deteksi_ai
```

MUST be calculated as:

```
SUM(ocr_detected_total)
FROM opex_receipts
WHERE opex_item_id = ?
```

### Aggregation Rules:

- NULL values MUST be ignored.
- If all values are NULL → total = 0.
- The total MUST NOT be manually editable.
- Aggregation MUST be calculated in backend.
- Frontend MUST NOT calculate this value.

### Preferred Implementation:

- Calculate dynamically during data retrieval.
- Do NOT cache unless necessary.

---

# 5. API REQUIREMENTS

## 5.1 POST /opex_items

Flow MUST be:

1. Create `opex_item` record.
2. Validate number of uploaded files (1–10).
3. Upload files to storage.
4. Insert one `opex_receipts` record per file.
5. Run OCR per receipt.
6. Store OCR result per receipt.
7. Calculate aggregated total.
8. Return aggregated total in response.

---

## 5.2 PUT /opex_items/:id

Editing MUST allow:

- Adding new receipts (up to max 10 total)
- Deleting receipts
- Replacing receipts

Validation:

- Total receipts per item MUST NOT exceed 10.
- If all receipts are removed → reject request.
- After any modification → recalculate aggregated total.

---

# 6. FRONTEND REQUIREMENTS

On Create / Edit Kegiatan page:

- There MUST be an "Add Receipt" button.
- Each click adds one file upload input.
- Maximum 10 file inputs allowed.
- Existing receipts MUST be displayed when editing.
- Each receipt MUST have a delete option.

The field:

```
hasil_deteksi_ai
```

- MUST be read-only.
- MUST display aggregated total returned from backend.

---

# 7. FILE STORAGE REQUIREMENTS

- File binaries MUST NOT be stored in database.
- Only file_path MUST be stored.
- Files MUST be stored in server storage or designated upload directory.

---

# 8. DATA INTEGRITY REQUIREMENTS

- Each receipt MUST belong to exactly one `opex_item`.
- Deleting `opex_item` MUST delete all associated receipts.
- The system MUST enforce maximum 10 receipts per item.
- The system MUST enforce minimum 1 receipt per item.

---

# 9. FORBIDDEN IMPLEMENTATIONS

The system MUST NOT:

- Store multiple file paths in a single column.
- Use comma-separated strings for receipt storage.
- Use JSON arrays inside `opex_items` for receipts.
- Allow manual editing of `hasil_deteksi_ai`.
- Allow more than 10 receipts per `opex_item`.

---

END OF SPECIFICATION
