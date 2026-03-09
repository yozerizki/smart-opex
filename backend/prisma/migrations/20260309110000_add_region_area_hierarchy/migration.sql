-- Add hierarchy tables: regions -> areas -> districts
CREATE TABLE "regions" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(150) NOT NULL UNIQUE,
  "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "areas" (
  "id" SERIAL PRIMARY KEY,
  "region_id" INTEGER NOT NULL,
  "name" VARCHAR(150) NOT NULL,
  "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "areas_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "areas_region_id_name_key" UNIQUE ("region_id", "name")
);

-- Add area relation to districts and users
ALTER TABLE "districts" ADD COLUMN "area_id" INTEGER;
ALTER TABLE "users" ADD COLUMN "area_id" INTEGER;

-- Create defaults for existing data
INSERT INTO "regions" ("name") VALUES ('Default Region') ON CONFLICT ("name") DO NOTHING;

INSERT INTO "areas" ("region_id", "name")
SELECT r."id", 'Default Area'
FROM "regions" r
WHERE r."name" = 'Default Region'
ON CONFLICT ("region_id", "name") DO NOTHING;

-- Backfill existing districts into default area
UPDATE "districts"
SET "area_id" = a."id"
FROM "areas" a
JOIN "regions" r ON r."id" = a."region_id"
WHERE r."name" = 'Default Region'
  AND a."name" = 'Default Area'
  AND "districts"."area_id" IS NULL;

-- Ensure not null after backfill
ALTER TABLE "districts" ALTER COLUMN "area_id" SET NOT NULL;

-- Replace old unique(name) with unique(area_id, name)
DROP INDEX IF EXISTS "districts_name_key";
CREATE UNIQUE INDEX "districts_area_id_name_key" ON "districts"("area_id", "name");

-- Add foreign keys
ALTER TABLE "districts"
  ADD CONSTRAINT "districts_area_id_fkey"
  FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "users"
  ADD CONSTRAINT "users_area_id_fkey"
  FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill verifikator area scope to default area if empty
UPDATE "users"
SET "area_id" = a."id"
FROM "areas" a
JOIN "regions" r ON r."id" = a."region_id"
WHERE r."name" = 'Default Region'
  AND a."name" = 'Default Area'
  AND "users"."role" = 'verifikator'
  AND "users"."area_id" IS NULL;
