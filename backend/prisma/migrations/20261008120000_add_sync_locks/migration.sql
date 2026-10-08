-- CreateTable
CREATE TABLE "sync_locks" (
    "source_id" INTEGER NOT NULL,
    "owner" VARCHAR(100) NOT NULL,
    "acquired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_locks_pkey" PRIMARY KEY ("source_id")
);

-- AddForeignKey
ALTER TABLE "sync_locks" ADD CONSTRAINT "sync_locks_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "data_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
