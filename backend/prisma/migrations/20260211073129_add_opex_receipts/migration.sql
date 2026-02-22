-- CreateTable
CREATE TABLE "opex_receipts" (
    "id" SERIAL NOT NULL,
    "opex_item_id" INTEGER NOT NULL,
    "file_path" TEXT NOT NULL,
    "ocr_detected_total" DECIMAL(15,2),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opex_receipts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "opex_receipts" ADD CONSTRAINT "opex_receipts_opex_item_id_fkey" FOREIGN KEY ("opex_item_id") REFERENCES "opex_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
