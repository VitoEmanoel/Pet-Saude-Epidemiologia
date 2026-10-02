// Testes funcionais, de integração e de regressão da API.
// Rodam contra o sistema no ar (npm run start) com os dados já sincronizados.
import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  API,
  ORIGIN,
  PRIMARY_SOURCES,
  PUBLIC_SOURCES,
  RUN_TABNET,
  adminApi,
  adminLogin,
  api,
  assertSystemUp,
  sum
} from "../support/env.mjs";

let admin;

before(async () => {
  await assertSystemUp();
  const login = await adminLogin();
  assert.equal(login.status, 200, "login admin deve funcionar (confira ADMIN_PASSWORD no .env)");
  admin = adminApi(login.cookie);
});

describe("Funcional: catálogo e saúde", () => {
  test("GET /health fixa Parnaíba", async () => {
    const r = await api("/health");
    assert.equal(r.status, 200);
    assert.equal(r.json.city.ibgeCode, "2207702");
  });

  test("GET /api/sources lista as 6 fontes públicas e esconde a zika", async () => {
    const slugs = (await api("/api/sources")).json.sources.map((s) => s.slug).sort();
    assert.deepEqual(slugs, [...PUBLIC_SOURCES].sort());
  });

  test("Fonte interna (zika) não é exposta: 404", async () => {
    assert.equal((await api("/api/sources/zika_sinan")).status, 404);
  });

  for (const slug of PUBLIC_SOURCES) {
    test(`GET /api/sources/${slug} e /availability`, async () => {
      assert.equal((await api(`/api/sources/${slug}`)).json.source.slug, slug);
      assert.equal((await api(`/api/sources/${slug}/availability`)).status, 200);
    });
  }
});

describe("Integração: dados sincronizados", () => {
  for (const slug of PUBLIC_SOURCES) {
    test(`${slug}: resumo, filtros, 4 gráficos e registros coerentes`, async () => {
      const summary = (await api(`/api/sources/${slug}/summary`)).json.summary;
      assert.ok(summary.totalRecords > 0, "deve ter registros (rode npm run sync:data)");
      assert.ok(summary.firstAvailableYear <= summary.lastAvailableYear);
      assert.ok((await api(`/api/sources/${slug}/filters`)).json.filters.years.length > 0);

      const [yearly, bySex, byAge, byRace] = await Promise.all(
        ["yearly-evolution", "by-sex", "by-age-group", "by-race-color"].map((chart) =>
          api(`/api/charts/${chart}?source=${slug}`).then((r) => r.json.series)
        )
      );
      // Cada fatia (sexo, faixa etária, raça/cor) soma o mesmo total anual
      assert.equal(sum(yearly), summary.totalCases, "evolução anual = total de casos");
      assert.equal(sum(bySex), sum(yearly), "soma por sexo = total");
      assert.equal(sum(byAge), sum(yearly), "soma por faixa etária = total");
      assert.equal(sum(byRace), sum(yearly), "soma por raça/cor = total");

      const records = (await api(`/api/records?source=${slug}&pageSize=5&aggregation=all`)).json;
      assert.equal(records.pagination.total, summary.totalRecords, "aggregation=all traz todas as visões");
      assert.ok(records.records.every((r) => r.city.ibgeCode === "2207702"));
    });
  }

  test("D4: total geral = soma das fontes primárias públicas (sem zika, sem duplicar a dengue)", async () => {
    const overview = (await api("/api/dashboard/overview")).json;
    let publicTotal = 0;
    for (const slug of PRIMARY_SOURCES) {
      publicTotal += (await api(`/api/sources/${slug}/summary`)).json.summary.totalCases;
    }
    assert.equal(overview.summary.totalCases, publicTotal);
    assert.equal(overview.summary.casesSourceCount, PRIMARY_SOURCES.length);
    assert.equal(overview.summary.sourcesWithMunicipalData, PUBLIC_SOURCES.length, "as 6 fontes públicas têm dados");
    assert.equal(sum(overview.charts.yearlyEvolution), overview.summary.totalCases, "gráfico geral soma o total");
  });

  test("D4: casos por doença na visão geral batem com o resumo de cada página", async () => {
    const { casesBySource } = (await api("/api/dashboard/overview")).json;
    assert.deepEqual(casesBySource.map((item) => item.slug).sort(), [...PUBLIC_SOURCES].sort());
    for (const item of casesBySource) {
      const summary = (await api(`/api/sources/${item.slug}/summary`)).json.summary;
      assert.equal(item.totalCases, summary.totalCases, item.slug);
      assert.equal(item.firstYear, summary.firstAvailableYear, item.slug);
      assert.equal(item.lastYear, summary.lastAvailableYear, item.slug);
    }
  });

  test("Arboviroses (derivada) inclui mais que a dengue", async () => {
    const arbo = (await api("/api/sources/arboviroses_sinan/summary")).json.summary.totalCases;
    const dengue = (await api("/api/sources/dengue_sinan/summary")).json.summary.totalCases;
    assert.ok(arbo > dengue);
  });

  test("Por ano: soma por sexo = total anual (últimos 3 anos de cada fonte)", async () => {
    for (const slug of PRIMARY_SOURCES) {
      const years = (await api(`/api/charts/yearly-evolution?source=${slug}`)).json.series;
      for (const { year, value } of years.slice(-3)) {
        const bySex = (await api(`/api/charts/by-sex?source=${slug}&year=${year}`)).json.series;
        assert.equal(sum(bySex), value, `${slug} ${year}`);
      }
    }
  });

  test("D3: tabela usa uma visão por vez e cada visão soma o total", async () => {
    const total = (await api("/api/charts/yearly-evolution?source=tuberculose_sinan&year=2024")).json.series[0].value;
    const byDefault = (await api("/api/records?source=tuberculose_sinan&year=2024&pageSize=500")).json;
    assert.equal(byDefault.aggregation, "yearly", "sem filtro, a visão padrão é o total do ano");
    assert.ok(byDefault.records.every((r) => r.aggregation === "yearly"));
    for (const view of ["yearly", "sex", "age_group", "race_color"]) {
      const r = (await api(`/api/records?source=tuberculose_sinan&year=2024&pageSize=500&aggregation=${view}`)).json;
      assert.ok(r.records.every((record) => record.aggregation === view), view);
      assert.equal(sum(r.records), total, `soma da visão ${view}`);
    }
  });

  test("D3: com filtro demográfico, a visão segue o filtro", async () => {
    const r = (await api("/api/records?source=tuberculose_sinan&sex=Masculino&pageSize=500")).json;
    assert.equal(r.aggregation, "sex");
    assert.ok(r.records.length > 0 && r.records.every((record) => record.sex === "Masculino"));
  });

  test("D3: visão inválida, visão incompatível com o filtro e dois filtros demográficos: 400", async () => {
    assert.equal((await api("/api/records?aggregation=xyz")).status, 400);
    assert.equal((await api("/api/records?source=tuberculose_sinan&sex=Masculino&aggregation=age_group")).status, 400);
    assert.equal((await api("/api/records?source=tuberculose_sinan&sex=Masculino&ageGroup=20-39")).status, 400);
  });

  test("D2: com filtro de sexo, os gráficos das outras dimensões não ficam vazios e avisam", async () => {
    const q = "source=tuberculose_sinan&sex=Masculino";
    const [yearly, bySex, byAge, byRace] = await Promise.all(
      ["yearly-evolution", "by-sex", "by-age-group", "by-race-color"].map((chart) => api(`/api/charts/${chart}?${q}`).then((r) => r.json))
    );
    assert.ok(byAge.series.length > 0, "faixa etária não pode ficar vazia");
    assert.ok(byRace.series.length > 0, "raça/cor não pode ficar vazia");
    assert.deepEqual(byAge.ignoredFilters, ["sex"]);
    assert.deepEqual(byRace.ignoredFilters, ["sex"]);
    assert.deepEqual(bySex.ignoredFilters, []);
    assert.deepEqual(bySex.series.map((p) => p.label), ["Masculino"]);
    assert.equal(sum(yearly.series), sum(bySex.series), "evolução anual com filtro de sexo = total masculino");
  });

  test("D2: gráficos com dois filtros demográficos: 400 (o DATASUS não cruza dimensões)", async () => {
    for (const chart of ["yearly-evolution", "by-sex", "by-age-group", "by-race-color"]) {
      assert.equal((await api(`/api/charts/${chart}?source=tuberculose_sinan&sex=Masculino&ageGroup=20-39`)).status, 400, chart);
    }
  });

  test("Paginação: páginas não se repetem e respeitam pageSize", async () => {
    const p1 = (await api("/api/records?source=tuberculose_sinan&page=1&pageSize=10")).json;
    const p2 = (await api("/api/records?source=tuberculose_sinan&page=2&pageSize=10")).json;
    assert.equal(p1.records.length, 10);
    const ids = new Set(p1.records.map((r) => r.id));
    assert.ok(p2.records.every((r) => !ids.has(r.id)));
    assert.equal(p1.pagination.totalPages, Math.ceil(p1.pagination.total / 10));
  });

  test("Paginação: pageSize acima do máximo é limitado a 500", async () => {
    assert.equal((await api("/api/records?pageSize=99999")).json.pagination.pageSize, 500);
  });

  test("Paginação: página além do fim retorna lista vazia", async () => {
    const r = await api("/api/records?source=dengue_sinan&page=9999");
    assert.equal(r.status, 200);
    assert.equal(r.json.records.length, 0);
  });
});

describe("Validação de entrada", () => {
  for (const param of ["city=Teresina", "municipio=x", "uf=CE", "ibgeCode=2211001", "estado=MA"]) {
    test(`Bloqueia filtro de outro município (${param}): 400`, async () => {
      assert.equal((await api(`/api/records?${param}`)).status, 400);
    });
  }

  test("Parâmetro desconhecido: 400", async () => {
    assert.equal((await api("/api/records?foo=1")).status, 400);
  });

  test("Gráfico sem source: 400", async () => {
    assert.equal((await api("/api/charts/by-sex")).status, 400);
  });

  test("Fonte inexistente: 404", async () => {
    assert.equal((await api("/api/charts/by-sex?source=covid")).status, 404);
  });

  test("Rota inexistente: 404 em JSON", async () => {
    const r = await api("/api/nao-existe");
    assert.equal(r.status, 404);
    assert.equal(r.json.error.code, "not_found");
  });

  test("Ano não numérico é ignorado sem erro", async () => {
    assert.equal((await api("/api/records?source=dengue_sinan&year=abc")).status, 200);
  });
});

describe("Área administrativa", () => {
  test("Sem sessão: 401 em todas as rotas protegidas", async () => {
    for (const path of ["/api/admin/auth/me", "/api/admin/sync-history", "/api/admin/audit-logs",
      "/api/admin/records/export.csv", "/api/admin/dashboard/export.html?source=dengue_sinan"]) {
      assert.equal((await api(path)).status, 401, path);
    }
  });

  test("Com sessão: me, histórico e auditoria", async () => {
    assert.equal((await admin("/api/admin/auth/me")).status, 200);
    assert.ok(Array.isArray((await admin("/api/admin/sync-history")).json.syncJobs));
    assert.ok(Array.isArray((await admin("/api/admin/audit-logs")).json.auditLogs));
  });

  test("Exportação CSV: padrão = total do ano, com coluna de visão", async () => {
    const r = await admin("/api/admin/records/export.csv?source=sifilis_congenita_sinan");
    assert.match(r.headers.get("content-type"), /text\/csv/);
    const [header, ...rows] = r.text.trim().split("\n");
    assert.match(header, /^source_slug,source_name,city/);
    assert.match(header, /,aggregation,/);
    const years = (await api("/api/charts/yearly-evolution?source=sifilis_congenita_sinan")).json.series.length;
    assert.equal(rows.length, years, "uma linha por ano");
    assert.ok(rows.every((row) => row.includes(",yearly,")));
  });

  test("Exportação CSV com aggregation=all traz todas as visões", async () => {
    const r = await admin("/api/admin/records/export.csv?source=sifilis_congenita_sinan&aggregation=all");
    const total = (await api("/api/sources/sifilis_congenita_sinan/summary")).json.summary.totalRecords;
    assert.equal(r.text.trim().split("\n").length - 1, total);
  });

  test("Exportação CSV com visão incompatível com o filtro: 400", async () => {
    assert.equal((await admin("/api/admin/records/export.csv?source=tuberculose_sinan&sex=Masculino&aggregation=age_group")).status, 400);
  });

  test("Exportação HTML do dashboard", async () => {
    const r = await admin("/api/admin/dashboard/export.html?source=tuberculose_sinan");
    assert.equal(r.status, 200);
    assert.match(r.text, /<!doctype html>/i);
  });

  test("Exportação HTML sem source: 400", async () => {
    assert.equal((await admin("/api/admin/dashboard/export.html")).status, 400);
  });

  test("Sincronizar fonte derivada (arboviroses): 501", async () => {
    assert.equal((await admin("/api/admin/sync/arboviroses_sinan", { method: "POST" })).status, 501);
  });

  test("Sincronização manual fim a fim, sem duplicar dados (TABNET)", { skip: !RUN_TABNET && "defina QA_TABNET=1 (usa a internet)" }, async () => {
    const before = (await api("/api/sources/sifilis_gestacional_sinan/summary")).json.summary;
    const r = await admin("/api/admin/sync/sifilis_gestacional_sinan", { method: "POST" });
    assert.equal(r.status, 200);
    assert.equal(r.json.syncJob.status, "SUCCESS");
    const after = (await api("/api/sources/sifilis_gestacional_sinan/summary")).json.summary;
    assert.equal(after.totalRecords, before.totalRecords);
    assert.equal(after.totalCases, before.totalCases);
  });

  test("Sincronizações simultâneas da mesma fonte: uma recebe 409 (TABNET)", { skip: !RUN_TABNET && "defina QA_TABNET=1 (usa a internet)" }, async () => {
    const [a, b] = await Promise.all([
      admin("/api/admin/sync/zika_sinan", { method: "POST" }),
      admin("/api/admin/sync/zika_sinan", { method: "POST" })
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  });

  test("Logout limpa o cookie de sessão", async () => {
    const login = await adminLogin();
    const r = await fetch(API + "/api/admin/auth/logout", { method: "POST", headers: { cookie: login.cookie, origin: ORIGIN } });
    assert.equal(r.status, 200);
    assert.match(r.headers.get("set-cookie") ?? "", /painel_admin_session=;/);
  });
});

describe("Regressão: números conhecidos (validados no TABNET)", () => {
  test("Tuberculose 2024 = 86 casos, também somando a tabela (D3)", async () => {
    const records = (await api("/api/records?source=tuberculose_sinan&year=2024&pageSize=500")).json.records;
    assert.equal(sum(records), 86);
  });

  test("Tuberculose 2024 = 86 casos no gráfico anual", async () => {
    const series = (await api("/api/charts/yearly-evolution?source=tuberculose_sinan&year=2024")).json.series;
    assert.equal(series[0].value, 86);
  });

  test("Tuberculose 2001–2025 = 1.856 casos em 500 registros", async () => {
    const s = (await api("/api/sources/tuberculose_sinan/summary")).json.summary;
    assert.equal(s.firstAvailableYear, 2001);
    assert.equal(s.totalCases, 1856);
    assert.equal(s.totalRecords, 500);
  });
});

// Defeitos conhecidos (docs/11). Marcados como "todo": rodam e mostram o defeito, mas não
// derrubam a suíte. Ao corrigir o item, remova o "todo" e o teste passa a ser obrigatório.
describe("Defeitos conhecidos", () => {
  test("D1: dengue tem dados depois de 2013", { todo: "D1 — Fase 1" }, async () => {
    const s = (await api("/api/sources/dengue_sinan/summary")).json.summary;
    assert.ok(s.lastAvailableYear > 2013, `último ano = ${s.lastAvailableYear}`);
  });

  test("S6: JSON inválido retorna erro em JSON", { todo: "S6 — Fase 2" }, async () => {
    const r = await api("/api/admin/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: "{x"
    });
    assert.match(r.headers.get("content-type") ?? "", /json/, `retornou ${r.headers.get("content-type")}`);
  });
});
