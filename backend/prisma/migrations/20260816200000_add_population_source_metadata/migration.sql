ALTER TABLE "population_estimates"
ADD COLUMN "source_kind" VARCHAR(50) NOT NULL DEFAULT 'estimativa',
ADD COLUMN "reference_year" INTEGER NOT NULL DEFAULT 0;
