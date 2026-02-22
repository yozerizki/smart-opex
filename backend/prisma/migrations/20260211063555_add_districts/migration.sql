/*
  Warnings:

  - Added the required column `district_id` to the `opex_items` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "opex_items" ADD COLUMN     "district_id" INTEGER NOT NULL,
ADD COLUMN     "recipient_name" VARCHAR(150),
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "district_id" INTEGER;

-- CreateTable
CREATE TABLE "districts" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "districts_name_key" ON "districts"("name");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opex_items" ADD CONSTRAINT "opex_items_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
