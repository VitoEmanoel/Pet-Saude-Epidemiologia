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

  test("GET /api/sources lista as 8 fontes públicas (zika desde o A1, chikungunya desde o A2)", async () => {
    const slugs = (await api("/api/sources")).json.sources.map((s) => s.slug).sort();
    assert.deepEqual(slugs, [...PUBLIC_SOURCES].sort());
  });

  test("Fonte inexistente: 404", async () => {
    assert.equal((await api("/api/sources/chikungunya_inexistente")).status, 404);
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

  test("D4: total geral = soma das fontes primárias públicas (sem duplicar a dengue em arboviroses)", async () => {
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

  test("S14: ano não numérico é recusado (400); ano vazio vale como sem filtro", async () => {
    assert.equal((await api("/api/records?source=dengue_sinan&year=abc")).status, 400);
    assert.equal((await api("/api/records?source=dengue_sinan&year=")).status, 200);
  });
});

describe("Área administrativa", () => {
  test("Sem sessão: 401 em todas as rotas protegidas", async () => {
    for (const path of ["/api/admin/auth/me", "/api/admin/sync-history", "/api/admin/audit-logs", "/api/admin/source-health", "/api/admin/population", "/api/admin/indicators/export.csv?source=dengue_sinan",
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

  test("O5: situação das fontes lista todas as sincronizáveis com nível e problemas", async () => {
    const sources = (await admin("/api/admin/source-health")).json.sources;
    const slugs = sources.map((source) => source.slug).sort();
    assert.deepEqual(slugs, PRIMARY_SOURCES.slice().sort());
    for (const source of sources) {
      assert.ok(["ok", "warning", "error"].includes(source.level), source.slug);
      assert.ok(Array.isArray(source.problems));
    }
  });

  test("A4: população — pré-visualização, recusa de planilha com erro, gravação e restauração", async () => {
    const json = { "content-type": "application/json" };
    const before = (await admin("/api/admin/population")).json.population;
    const beforeCsv = (await admin("/api/admin/population/template.csv")).text;
    try {
      const bad = await admin("/api/admin/population/preview", { method: "POST", headers: json, body: JSON.stringify({ csv: "ano;populacao\n2020;abc" }) });
      assert.equal(bad.json.errors.length, 1);
      const refused = await admin("/api/admin/population", { method: "PUT", headers: json, body: JSON.stringify({ csv: "ano;populacao\n2020;abc" }) });
      assert.equal(refused.status, 400);

      const csv = "ano;populacao;populacao_60_mais\n2021;153.482;17.000\n2022;162159;";
      const preview = await admin("/api/admin/population/preview", { method: "POST", headers: json, body: JSON.stringify({ csv }) });
      assert.deepEqual(preview.json.errors, []);
      const saved = await admin("/api/admin/population", { method: "PUT", headers: json, body: JSON.stringify({ csv, sourceNote: "teste e2e" }) });
      assert.equal(saved.status, 200);
      assert.deepEqual(saved.json.population.map((row) => [row.year, row.population, row.population60Plus]), [[2021, 153482, 17000], [2022, 162159, null]]);
      const logs = (await admin("/api/admin/audit-logs")).json.auditLogs;
      assert.equal(logs.find((log) => log.action === "admin_population_upload")?.metadata?.sourceNote, "teste e2e");
    } finally {
      // Restaura a tabela de antes (pode estar vazia).
      if (before.length > 0) {
        await admin("/api/admin/population", { method: "PUT", headers: json, body: JSON.stringify({ csv: beforeCsv }) });
      } else {
        await admin("/api/admin/population", { method: "DELETE" });
      }
    }
    assert.equal((await admin("/api/admin/population")).json.population.length, before.length);
  });

  test("A5: indicadores calculados com população temporária (e sem estimar quando falta)", async () => {
    const json = { "content-type": "application/json" };
    const beforeCsv = (await admin("/api/admin/population/template.csv")).text;
    const hadPopulation = (await admin("/api/admin/population")).json.population.length > 0;
    try {
      await admin("/api/admin/population", { method: "PUT", headers: json, body: JSON.stringify({ csv: "ano;populacao;populacao_60_mais\n2022;162159;20000" }) });
      const dengue = (await api("/api/indicators?source=dengue_sinan")).json.indicators;
      const point = (key, year) => dengue.find((indicator) => indicator.key === key).series.find((p) => p.year === year);
      assert.equal(point("incidencia", 2022).value, 1279.61);
      assert.equal(point("incidencia", 2023).status, "sem_populacao");
      assert.equal(point("incidencia", 2023).value, null);
      assert.equal(point("pct_sinais_alarme", 2013).status, "nao_se_aplica");
      assert.equal(point("pct_sinais_alarme", 2024).value, 8.24, "42 de 510 casos (validado no TABNET)");
    } finally {
      if (hadPopulation) {
        await admin("/api/admin/population", { method: "PUT", headers: json, body: JSON.stringify({ csv: beforeCsv }) });
      } else {
        await admin("/api/admin/population", { method: "DELETE" });
      }
    }
  });

  test("A6: exportação dos indicadores em CSV (só no admin)", async () => {
    const r = await admin("/api/admin/indicators/export.csv?source=dengue_sinan");
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type") ?? "", /text\/csv/);
    assert.match(r.text, /indicador;unidade;ano;valor;numerador;denominador;situacao;provisorio/);
    assert.match(r.text, /% com sinais de alarme;%;2024;8,24;42;510;;nao/);
    assert.match(r.text, /% com sinais de alarme;%;2013;;;244;nao se aplica;nao/);
    assert.equal((await admin("/api/admin/indicators/export.csv?source=inexistente")).status, 404);
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
  test("D1: dengue vai de 2007 até depois de 2013, sem buraco na série", async () => {
    const s = (await api("/api/sources/dengue_sinan/summary")).json.summary;
    assert.equal(s.firstAvailableYear, 2007);
    assert.ok(s.lastAvailableYear > 2013, `último ano = ${s.lastAvailableYear}`);
    const years = (await api("/api/charts/yearly-evolution?source=dengue_sinan")).json.series.map((p) => p.year);
    for (let year = 2007; year <= s.lastAvailableYear; year += 1) {
      assert.ok(years.includes(year), `ano ${year} ausente`);
    }
  });

  test("D1: dengue 2022 = 2.075 casos prováveis (validado no TABNET em 02/10/2026)", async () => {
    const series = (await api("/api/charts/yearly-evolution?source=dengue_sinan&year=2022")).json.series;
    assert.equal(series[0].value, 2075);
  });

  test("D1: arboviroses inclui a dengue a partir de 2014", async () => {
    const dengue = (await api("/api/charts/yearly-evolution?source=dengue_sinan&year=2022")).json.series[0].value;
    const arbo = (await api("/api/charts/yearly-evolution?source=arboviroses_sinan&year=2022")).json.series[0].value;
    assert.ok(arbo >= dengue);
  });

  test("D7: zika entra em arboviroses só com casos prováveis (33, validado no TABNET em 02/10/2026)", async () => {
    const arbo = (await api("/api/sources/arboviroses_sinan/summary")).json.summary.totalCases;
    const dengue = (await api("/api/sources/dengue_sinan/summary")).json.summary.totalCases;
    const chik = (await api("/api/sources/chikungunya_sinan/summary")).json.summary.totalCases;
    assert.equal(arbo - dengue - chik, 33, "zika deveria somar 33 casos prováveis (187 com descartados)");
    assert.equal((await api("/api/sources/zika_sinan/summary")).json.summary.totalCases, 33);
  });

  test("A2: chikungunya = 1.714 casos prováveis, 2017 = 841 (validado no TABNET em 02/10/2026)", async () => {
    assert.equal((await api("/api/sources/chikungunya_sinan/summary")).json.summary.totalCases, 1714);
    const series = (await api("/api/charts/yearly-evolution?source=chikungunya_sinan&year=2017")).json.series;
    assert.equal(series[0].value, 841);
  });

  test("A3: arboviroses = dengue + zika + chikungunya, ano a ano", async () => {
    const yearly = async (slug) =>
      Object.fromEntries((await api(`/api/charts/yearly-evolution?source=${slug}`)).json.series.map((point) => [point.year, point.value]));
    const [arbo, dengue, zika, chik] = await Promise.all(
      ["arboviroses_sinan", "dengue_sinan", "zika_sinan", "chikungunya_sinan"].map(yearly)
    );
    for (const year of Object.keys(arbo)) {
      assert.equal(arbo[year], (dengue[year] ?? 0) + (zika[year] ?? 0) + (chik[year] ?? 0), `ano ${year}`);
    }
  });

  test("A5: indicadores só nas arboviroses; parâmetro extra 400; fonte inexistente 404", async () => {
    const keys = async (slug) => (await api(`/api/indicators?source=${slug}`)).json.indicators.map((i) => i.key);
    assert.deepEqual(await keys("dengue_sinan"), ["casos", "incidencia", "pct_sinais_alarme", "pct_grave"]);
    assert.deepEqual(await keys("chikungunya_sinan"), ["casos", "incidencia", "incidencia_idosos", "casos_confirmados"]);
    assert.deepEqual(await keys("tuberculose_sinan"), []);
    assert.equal((await api("/api/indicators?source=dengue_sinan&year=2022")).status, 400);
    assert.equal((await api("/api/indicators?source=inexistente")).status, 404);
    const zika = (await api("/api/indicators?source=zika_sinan")).json.indicators.find((i) => i.key === "casos_confirmados");
    assert.equal(zika.series.reduce((total, p) => total + (p.value ?? 0), 0), 19, "19 confirmados (validado no TABNET)");
  });

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

// Erros de entrada devolvem JSON no formato padrão (antes do S6, vinham em HTML).
describe("Erros", () => {
  test("S6: JSON inválido retorna erro em JSON", async () => {
    const r = await api("/api/admin/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: "{x"
    });
    assert.match(r.headers.get("content-type") ?? "", /json/, `retornou ${r.headers.get("content-type")}`);
    assert.equal(r.status, 400);
    assert.equal(r.json?.error?.code, "invalid_body");
  });
});
