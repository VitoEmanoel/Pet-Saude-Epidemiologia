import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { ALLOWED_CITY } from "../../config/city";
import { prisma } from "../../database/prisma";
import {
  getChartByAgeGroup,
  getChartByRaceColor,
  getChartBySex,
  getDashboardOverview,
  getRecords,
  getSourceFilters,
  getSourceSummary,
  getYearlyEvolution
} from "./public-data.service";

// Q1: as somas que o site mostra, com dados controlados no banco de TESTE (S10).
// Cada caso é gravado em 4 visões (total do ano, por sexo, por faixa etária, por raça/cor):
// as somas nunca podem misturar visões, senão o mesmo caso conta 2, 3 ou 4 vezes.

const SOURCE = "hanseniase_sinan";
const OTHER = "tuberculose_sinan";

type View = "yearly" | "by_sex" | "by_age_group" | "by_race_color";

async function insert(slug: string, prefix: string, view: View, year: number, value: number, dimension: Partial<Record<"sex" | "ageGroup" | "raceColor", string>> = {}) {
  const source = await prisma.dataSource.findUniqueOrThrow({ where: { slug } });
  await prisma.epidemiologicalRecord.create({
    data: {
      sourceId: source.id,
      state: ALLOWED_CITY.state,
      stateCode: ALLOWED_CITY.uf,
      city: ALLOWED_CITY.name,
      cityIbgeCode: ALLOWED_CITY.ibgeCode,
      year,
      diseaseOrCondition: "Teste",
      metric: "casos",
      value,
      sex: dimension.sex ?? null,
      ageGroup: dimension.ageGroup ?? null,
      raceColor: dimension.raceColor ?? null,
      sourceTable: `${prefix}_${view}_residence`,
      recordKey: `teste|${slug}|${view}|${year}|${dimension.sex ?? ""}|${dimension.ageGroup ?? ""}|${dimension.raceColor ?? ""}`
    }
  });
}

before(async () => {
  // Trava: este teste apaga registros. Só roda no banco de teste.
  const database = new URL(process.env.DATABASE_URL ?? "postgresql://x@x/x").pathname.replace(/^\//, "");
  assert.ok(database.endsWith("_test"), `public-data.test só roda no banco de teste (está em "${database}")`);
  await prisma.epidemiologicalRecord.deleteMany({});

  // Hanseníase: 2023 = 10 casos, 2024 = 20 casos, nas 4 visões (somas iguais em cada visão).
  const p = "tabnet_hanseniase";
  await insert(SOURCE, p, "yearly", 2023, 10);
  await insert(SOURCE, p, "yearly", 2024, 20);
  await insert(SOURCE, p, "by_sex", 2023, 6, { sex: "Masculino" });
  await insert(SOURCE, p, "by_sex", 2023, 4, { sex: "Feminino" });
  await insert(SOURCE, p, "by_sex", 2024, 12, { sex: "Masculino" });
  await insert(SOURCE, p, "by_sex", 2024, 8, { sex: "Feminino" });
  await insert(SOURCE, p, "by_age_group", 2023, 7, { ageGroup: "20-39" });
  await insert(SOURCE, p, "by_age_group", 2023, 3, { ageGroup: "40-59" });
  await insert(SOURCE, p, "by_age_group", 2024, 15, { ageGroup: "20-39" });
  await insert(SOURCE, p, "by_age_group", 2024, 5, { ageGroup: "Menor de 1 ano" });
  await insert(SOURCE, p, "by_race_color", 2023, 10, { raceColor: "Parda" });
  await insert(SOURCE, p, "by_race_color", 2024, 18, { raceColor: "Parda" });
  await insert(SOURCE, p, "by_race_color", 2024, 2, { raceColor: "Branca" });
  // Outra fonte, para conferir que uma não vaza na outra e a visão geral soma as duas.
  await insert(OTHER, "tabnet_tuberculose", "yearly", 2024, 5);
  await insert(OTHER, "tabnet_tuberculose", "by_sex", 2024, 5, { sex: "Masculino" });
});

after(async () => {
  await prisma.epidemiologicalRecord.deleteMany({});
  await prisma.$disconnect();
});

test("Q1: evolução anual usa só a visão 'total do ano' (sem contar o caso 4 vezes)", async () => {
  assert.deepEqual(await getYearlyEvolution(SOURCE), [
    { year: 2023, value: 10 },
    { year: 2024, value: 20 }
  ]);
});

test("Q1: com filtro de sexo, a evolução anual vem da visão por sexo", async () => {
  assert.deepEqual(await getYearlyEvolution(SOURCE, { sex: "Feminino" }), [
    { year: 2023, value: 4 },
    { year: 2024, value: 8 }
  ]);
  assert.deepEqual(await getYearlyEvolution(SOURCE, { ageGroup: "20-39", year: 2024 }), [{ year: 2024, value: 15 }]);
});

test("Q1: gráficos por dimensão somam a mesma quantidade que o total do ano", async () => {
  const total = (rows: Array<{ value: number }>) => rows.reduce((sum, row) => sum + row.value, 0);
  assert.equal(total(await getChartBySex(SOURCE)), 30);
  assert.equal(total(await getChartByAgeGroup(SOURCE)), 30);
  assert.equal(total(await getChartByRaceColor(SOURCE)), 30);
  assert.deepEqual(await getChartBySex(SOURCE, { year: 2024 }), [
    { label: "Feminino", value: 8 },
    { label: "Masculino", value: 12 }
  ]);
});

test("Q1: faixa etária em ordem de idade, não alfabética ('Menor de 1 ano' antes de '20-39')", async () => {
  assert.deepEqual(
    (await getChartByAgeGroup(SOURCE)).map((row) => row.label),
    ["Menor de 1 ano", "20-39", "40-59"]
  );
});

test("Q1: gráfico de outra dimensão ignora o filtro que não consegue aplicar (o DATASUS não cruza)", async () => {
  // Com filtro de sexo, o gráfico por raça/cor mostra todas as pessoas (a tela avisa).
  assert.deepEqual(await getChartByRaceColor(SOURCE, { sex: "Feminino", year: 2024 }), [
    { label: "Branca", value: 2 },
    { label: "Parda", value: 18 }
  ]);
});

test("Q1: resumo da fonte: casos = soma do total do ano; período e último ano", async () => {
  const result = await getSourceSummary(SOURCE);
  assert.ok(result, "fonte existe");
  const { summary } = result;
  assert.equal(summary.totalCases, 30);
  assert.equal(summary.firstAvailableYear, 2023);
  assert.equal(summary.lastAvailableYear, 2024);
  assert.equal(summary.latestYear, 2024);
  assert.equal(summary.latestYearValue, 20);
});

test("Q1: tabela de registros mostra uma visão por vez e o total da paginação bate", async () => {
  const yearly = await getRecords({ source: SOURCE }, { page: 1, pageSize: 50 });
  assert.equal(yearly.aggregation, "yearly");
  assert.equal(yearly.pagination.total, 2);
  const bySex = await getRecords({ source: SOURCE, aggregation: "sex" }, { page: 1, pageSize: 50 });
  assert.equal(bySex.pagination.total, 4);
  assert.equal(bySex.records.reduce((sum, record) => sum + (record.value ?? 0), 0), 30);
  const page2 = await getRecords({ source: SOURCE, aggregation: "sex" }, { page: 2, pageSize: 3 });
  assert.equal(page2.records.length, 1);
  assert.equal(page2.pagination.totalPages, 2);
});

test("Q1: filtros oferecidos são os que existem nos dados da fonte", async () => {
  const filters = await getSourceFilters(SOURCE);
  const values = JSON.stringify(filters);
  for (const expected of ["2023", "2024", "Masculino", "Feminino", "20-39", "Parda", "Branca"]) {
    assert.ok(values.includes(expected), `faltou ${expected}`);
  }
});

test("Q1: visão geral soma as fontes (sem misturar visões) e lista cada uma", async () => {
  const overview = await getDashboardOverview();
  assert.equal(overview.summary.totalCases, 35);
  const bySource = Object.fromEntries(overview.casesBySource.map((item) => [item.slug, item.totalCases]));
  assert.equal(bySource[SOURCE], 30);
  assert.equal(bySource[OTHER], 5);
  assert.equal(
    overview.charts.yearlyEvolution.reduce((sum: number, point: { value: number }) => sum + point.value, 0),
    35
  );
});
