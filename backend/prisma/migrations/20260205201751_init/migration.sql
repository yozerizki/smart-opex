-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "position" VARCHAR(100) NOT NULL,
    "nip" VARCHAR(50),
    "phone_number" VARCHAR(30) NOT NULL,
    "nik_ktp" VARCHAR(20) NOT NULL,
    "ktp_scan_path" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opex_projects" (
    "id" SERIAL NOT NULL,
    "project_name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "status" VARCHAR(20) DEFAULT 'DRAFT',
    "created_by" INTEGER,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opex_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opex_items" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER,
    "item_name" VARCHAR(150) NOT NULL,
    "category" VARCHAR(100),
    "amount" DECIMAL(15,2),
    "transaction_date" DATE,
    "status" VARCHAR(20) DEFAULT 'SUBMITTED',
    "created_by" INTEGER,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opex_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- CreateTable
CREATE TABLE "approvals" (
    "id" SERIAL NOT NULL,
    "opex_item_id" INTEGER,
    "approved_by" INTEGER,
    "action" VARCHAR(20),
    "notes" TEXT,
    "approved_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" SERIAL NOT NULL,
    "opex_item_id" INTEGER,
    "file_path" TEXT NOT NULL,
    "file_type" VARCHAR(50),
    "uploaded_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocr_results" (
    "id" SERIAL NOT NULL,
    "document_id" INTEGER,
    "extracted_text" TEXT,
    "parsed_amount" DECIMAL(15,2),
    "parsed_date" DATE,
    "confidence_score" DECIMAL(5,2),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" VARCHAR(100),
    "entity" VARCHAR(50),
    "entity_id" INTEGER,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opex_projects" ADD CONSTRAINT "opex_projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opex_items" ADD CONSTRAINT "opex_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opex_items" ADD CONSTRAINT "opex_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "opex_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_opex_item_id_fkey" FOREIGN KEY ("opex_item_id") REFERENCES "opex_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_opex_item_id_fkey" FOREIGN KEY ("opex_item_id") REFERENCES "opex_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_results" ADD CONSTRAINT "ocr_results_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
