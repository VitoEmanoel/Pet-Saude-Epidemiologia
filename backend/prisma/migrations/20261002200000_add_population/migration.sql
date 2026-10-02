-- CreateTable
CREATE TABLE "population_estimates" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "population" INTEGER NOT NULL,
    "population_60_plus" INTEGER,
    "source_note" VARCHAR(200),
    "updated_by" VARCHAR(100),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "population_estimates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "population_estimates_year_key" ON "population_estimates"("year");
