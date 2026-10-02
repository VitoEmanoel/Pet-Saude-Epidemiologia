-- CreateTable
CREATE TABLE "classification_counts" (
    "id" SERIAL NOT NULL,
    "source_id" INTEGER NOT NULL,
    "sync_job_id" INTEGER,
    "year" INTEGER NOT NULL,
    "classification" VARCHAR(100) NOT NULL,
    "value" DECIMAL(14,4) NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classification_counts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "classification_counts_source_id_year_classification_key" ON "classification_counts"("source_id", "year", "classification");

-- AddForeignKey
ALTER TABLE "classification_counts" ADD CONSTRAINT "classification_counts_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "data_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_counts" ADD CONSTRAINT "classification_counts_sync_job_id_fkey" FOREIGN KEY ("sync_job_id") REFERENCES "sync_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
