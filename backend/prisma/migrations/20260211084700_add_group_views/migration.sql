-- AlterTable
ALTER TABLE "opex_items" ADD COLUMN     "group_view_id" INTEGER;

-- CreateTable
CREATE TABLE "group_views" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "group_views_name_key" ON "group_views"("name");

-- AddForeignKey
ALTER TABLE "opex_items" ADD CONSTRAINT "opex_items_group_view_id_fkey" FOREIGN KEY ("group_view_id") REFERENCES "group_views"("id") ON DELETE SET NULL ON UPDATE CASCADE;
