/*
  Warnings:

  - You are about to drop the `approvals` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "approvals" DROP CONSTRAINT "approvals_approved_by_fkey";

-- DropForeignKey
ALTER TABLE "approvals" DROP CONSTRAINT "approvals_opex_item_id_fkey";

-- DropTable
DROP TABLE "approvals";
