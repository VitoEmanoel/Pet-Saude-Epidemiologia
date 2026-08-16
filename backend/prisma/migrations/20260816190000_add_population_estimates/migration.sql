CREATE TABLE "population_estimates" (
    "id" SERIAL NOT NULL,
    "city_ibge_code" VARCHAR(20) NOT NULL,
    "year" INTEGER NOT NULL,
    "population" INTEGER NOT NULL,
    "source_url" TEXT NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "population_estimates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "population_estimates_city_ibge_code_year_key" ON "population_estimates"("city_ibge_code", "year");
