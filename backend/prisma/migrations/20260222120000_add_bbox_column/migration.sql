-- AlterTable
ALTER TABLE "opex_receipts" ADD COLUMN IF NOT EXISTS "ocr_bbox_json" TEXT;
