-- CreateEnum
CREATE TYPE "SourceAvailabilityStatus" AS ENUM ('UNKNOWN', 'AVAILABLE', 'MUNICIPAL_FILTER_UNAVAILABLE', 'NO_RECORDS_FOR_CITY', 'ERROR');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'UNAVAILABLE', 'SKIPPED');

-- CreateTable
CREATE TABLE "data_sources" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "system" VARCHAR(100) NOT NULL,
    "category" VARCHAR(100) NOT NULL DEFAULT 'epidemiologicas_morbidade',
    "source_url" TEXT,
    "municipality_filter_available" BOOLEAN,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_availability" (
    "id" SERIAL NOT NULL,
    "source_id" INTEGER NOT NULL,
    "status" "SourceAvailabilityStatus" NOT NULL DEFAULT 'UNKNOWN',
    "message" TEXT,
    "checked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_jobs" (
    "id" SERIAL NOT NULL,
    "source_id" INTEGER,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "records_imported" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "requested_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_imports" (
    "id" SERIAL NOT NULL,
    "source_id" INTEGER NOT NULL,
    "sync_job_id" INTEGER,
    "request_url" TEXT,
    "request_params" JSONB,
    "response_format" VARCHAR(50),
    "content_hash" VARCHAR(128),
    "stored_path" TEXT,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "epidemiological_records" (
    "id" SERIAL NOT NULL,
    "source_id" INTEGER NOT NULL,
    "sync_job_id" INTEGER,
    "state" VARCHAR(100) NOT NULL DEFAULT 'Piauí',
    "state_code" VARCHAR(2) NOT NULL DEFAULT 'PI',
    "city" VARCHAR(100) NOT NULL DEFAULT 'Parnaíba',
    "city_ibge_code" VARCHAR(20) NOT NULL DEFAULT '2207702',
    "year" INTEGER,
    "month" INTEGER,
    "disease_or_condition" VARCHAR(255),
    "metric" VARCHAR(100),
    "value" DECIMAL(18,4),
    "sex" VARCHAR(50),
    "age_group" VARCHAR(100),
    "race_color" VARCHAR(100),
    "dimensions" JSONB,
    "source_table" VARCHAR(255),
    "record_key" VARCHAR(128) NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "epidemiological_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "data_sources_slug_key" ON "data_sources"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "data_availability_source_id_key" ON "data_availability"("source_id");

-- CreateIndex
CREATE INDEX "sync_jobs_source_id_idx" ON "sync_jobs"("source_id");

-- CreateIndex
CREATE INDEX "sync_jobs_status_idx" ON "sync_jobs"("status");

-- CreateIndex
CREATE INDEX "sync_jobs_created_at_idx" ON "sync_jobs"("created_at");

-- CreateIndex
CREATE INDEX "raw_imports_source_id_idx" ON "raw_imports"("source_id");

-- CreateIndex
CREATE INDEX "raw_imports_sync_job_id_idx" ON "raw_imports"("sync_job_id");

-- CreateIndex
CREATE INDEX "raw_imports_content_hash_idx" ON "raw_imports"("content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "epidemiological_records_record_key_key" ON "epidemiological_records"("record_key");

-- CreateIndex
CREATE INDEX "epidemiological_records_source_id_year_idx" ON "epidemiological_records"("source_id", "year");

-- CreateIndex
CREATE INDEX "epidemiological_records_source_id_year_sex_idx" ON "epidemiological_records"("source_id", "year", "sex");

-- CreateIndex
CREATE INDEX "epidemiological_records_source_id_year_age_group_idx" ON "epidemiological_records"("source_id", "year", "age_group");

-- CreateIndex
CREATE INDEX "epidemiological_records_source_id_disease_or_condition_idx" ON "epidemiological_records"("source_id", "disease_or_condition");

-- CreateIndex
CREATE INDEX "epidemiological_records_imported_at_idx" ON "epidemiological_records"("imported_at");

-- AddForeignKey
ALTER TABLE "data_availability" ADD CONSTRAINT "data_availability_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "data_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_imports" ADD CONSTRAINT "raw_imports_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "data_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_imports" ADD CONSTRAINT "raw_imports_sync_job_id_fkey" FOREIGN KEY ("sync_job_id") REFERENCES "sync_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epidemiological_records" ADD CONSTRAINT "epidemiological_records_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "data_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epidemiological_records" ADD CONSTRAINT "epidemiological_records_sync_job_id_fkey" FOREIGN KEY ("sync_job_id") REFERENCES "sync_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
