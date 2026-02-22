# Data Flow and Status States – Smart OPEX

## Activity Lifecycle

1. Activity Created
2. Transaction Data Input
3. Document Upload
4. OCR Processing
5. Validation Check (Exact Match)
6. Status Assignment
7. Manual Review (if needed)
8. Export to Excel

## Status Definitions

- DRAFT  
  Activity is being prepared and not yet processed.

 - PROCESSED  
  (removed — not used in codebase; OCR processing outcome is represented by `OK` or `PERLU_REVIEW`)

- PERLU_REVIEW  
  One or more validation rules failed (e.g. OCR total ≠ input total).

- OK  
  Validation passed or manual review completed.

## Notes
- "PERLU_REVIEW" is an informational flag only.
- The system does not block exports based on status.
- There is no system-level approval or rejection state.
