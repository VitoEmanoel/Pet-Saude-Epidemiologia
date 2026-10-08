import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { parseClassificationCounts, parseSinanQuery } from "./sinan-tabnet.collector";
import { decodeHtmlEntities, parsePrnTable } from "./tabnet-prn";

// Q1: testes do núcleo da coleta (ler a resposta do TABNET e normalizar), sem internet.
// Respostas reais guardadas em docs/evidencias/ (conferidas à mão no validacao.md de cada fonte)
// e respostas sintéticas no mesmo formato para os casos difíceis.

const EVIDENCE_DIR = path.resolve(process.cwd(), "../docs/evidencias");
const evidence = (relativePath: string) => readFileSync(path.join(EVIDENCE_DIR, relativePath), "latin1");

/** Resposta no formato do TABNET: o "prn" vem num bloco <PRE>, linhas com ";". */
const tabnetHtml = (...lines: string[]) =>
  `<HTML><BODY><B>Município de residência: 220770 PARNAIBA</B><PRE>\n${lines.join("\n")}\n</PRE></BODY></HTML>`;

test("Q1: dengue 2014–2026, resposta real do TABNET (docs/evidencias, validada em 02/10/2026)", () => {
  const records = parseSinanQuery(
    "dengue_sinan",
    "yearly",
    evidence("dengue_sinan/consulta_parnaiba_residencia_2014-2026_prn_2026-10-02.html")
  );
  const byYear = Object.fromEntries(records.map((record) => [record.year, record.value]));

  assert.deepEqual(byYear, {
    2014: 99, 2015: 219, 2016: 108, 2017: 170, 2018: 5, 2019: 89, 2020: 40,
    2021: 140, 2022: 2075, 2023: 752, 2024: 510, 2025: 152, 2026: 969
  });
  // A linha "Total" do TABNET não vira registro (senão o total contaria em dobro).
  assert.equal(records.reduce((total, record) => total + record.value, 0), 5328);
  assert.ok(records.every((record) => record.sex === null && record.ageGroup === null && record.raceColor === null));
});

test("Q1: tuberculose 2024 = 86, resposta real do TABNET (docs/evidencias, validada em 13/06/2026)", () => {
  const records = parseSinanQuery(
    "tuberculose_sinan",
    "yearly",
    evidence("tuberculose_sinan/consulta_parnaiba_residencia_2024_prn_2026-06-13.html")
  );
  assert.deepEqual(records.map((record) => [record.year, record.value]), [[2024, 86]]);
});

test("Q1: leitor do prn decodifica acentos do HTML, tira aspas e ignora linhas vazias e '&'", () => {
  const table = parsePrnTable(
    tabnetHtml('"Ano Diagn&oacute;stico";"Ra&ccedil;a";"Ind&iacute;gena"', "&", "", '"2024";"1";2')
  );
  assert.deepEqual(table.headers, ["Ano Diagnóstico", "Raça", "Indígena"]);
  assert.deepEqual(table.rows, [["2024", "1", "2"]]);
  assert.equal(decodeHtmlEntities("&#233;&#xE7;&nbsp;&desconhecido;"), "éç &desconhecido;");
});

test("Q1: resposta sem <PRE> ou sem dados é erro (layout do TABNET mudou), não zero casos", () => {
  assert.throws(() => parsePrnTable("<html>Manutenção</html>"), /não contém bloco PRE/);
  assert.throws(() => parsePrnTable(tabnetHtml('"Ano";"Casos"')), /não contém linhas de dados/);
});

test("Q1: por sexo: normaliza rótulos, '-' vira 0 e a coluna Total fica de fora", () => {
  const records = parseSinanQuery(
    "tuberculose_sinan",
    "by_sex",
    tabnetHtml('"Ano Diagnóstico";"Ignorado";"Masculino";"Feminino";"Total"', '"2023";-;40;20;60', '"Total";-;40;20;60')
  );
  assert.deepEqual(
    records.map((record) => [record.year, record.sex, record.value]),
    [[2023, "Ignorado", 0], [2023, "Masculino", 40], [2023, "Feminino", 20]]
  );
  assert.ok(records.every((record) => record.sourceTable.includes("_by_sex_")));
});

test("Q1: faixa etária: '<1 Ano', '80 e +' e 'Em Branco/IGN' viram os rótulos do painel", () => {
  const records = parseSinanQuery(
    "tuberculose_sinan",
    "by_age_group",
    tabnetHtml('"Ano Diagnóstico";"Em Branco/IGN";"<1 Ano";"1-4";"80 e +";"Total"', '"2024";1;2;3;4;10')
  );
  assert.deepEqual(
    records.map((record) => [record.ageGroup, record.value]),
    [["Ignorado", 1], ["Menor de 1 ano", 2], ["1-4", 3], ["80 anos e mais", 4]]
  );
});

test("Q1: raça/cor: sem acento vira com acento ('Indigena' → 'Indígena') e 'Ign/Branco' → 'Ignorado'", () => {
  const records = parseSinanQuery(
    "tuberculose_sinan",
    "by_race_color",
    tabnetHtml('"Ano Diagnóstico";"Ign/Branco";"Branca";"Preta";"Amarela";"Parda";"Indigena";"Total"', '"2024";1;2;3;4;5;6;21')
  );
  assert.deepEqual(
    records.map((record) => [record.raceColor, record.value]),
    [["Ignorado", 1], ["Branca", 2], ["Preta", 3], ["Amarela", 4], ["Parda", 5], ["Indígena", 6]]
  );
});

test("Q1: números do TABNET: ponto de milhar e vírgula decimal; ano inválido e linha Total são ignorados", () => {
  const records = parseSinanQuery(
    "dengue_sinan",
    "yearly",
    tabnetHtml('"Ano 1º Sintoma(s)";"Casos Prováveis"', '"2022";2.075', '"2023";1,5', '"Ign/Branco";9', '"Total";2.076,5')
  );
  assert.deepEqual(records.map((record) => [record.year, record.value]), [[2022, 2075], [2023, 1.5]]);
});

test("Q1: cada registro tem chave estável e diferente por ano e categoria (sem duplicar no banco)", () => {
  const html = tabnetHtml('"Ano Diagnóstico";"Masculino";"Feminino"', '"2023";1;2', '"2024";3;4');
  const first = parseSinanQuery("tuberculose_sinan", "by_sex", html).map((record) => record.recordKey);
  const again = parseSinanQuery("tuberculose_sinan", "by_sex", html).map((record) => record.recordKey);
  assert.deepEqual(first, again, "a mesma consulta gera as mesmas chaves");
  assert.equal(new Set(first).size, 4, "chaves únicas por ano e sexo");
  const otherSource = parseSinanQuery("hanseniase_sinan", "by_sex", html).map((record) => record.recordKey);
  assert.equal(new Set([...first, ...otherSource]).size, 8, "fontes diferentes não colidem");
});

test("Q1: classificação final: tabela ano × classificação, sem Total e sem os '-' (zeros)", () => {
  const counts = parseClassificationCounts(
    tabnetHtml(
      '"Ano 1º Sintoma(s)";"Ign/Branco";"Dengue";"Dengue com sinais de alarme";"Dengue grave";"Total"',
      '"2024";10;457;42;1;510',
      '"2025";-;150;2;-;152',
      '"Total";10;607;44;1;662'
    )
  );
  assert.deepEqual(counts, [
    { year: 2024, classification: "Ign/Branco", value: 10 },
    { year: 2024, classification: "Dengue", value: 457 },
    { year: 2024, classification: "Dengue com sinais de alarme", value: 42 },
    { year: 2024, classification: "Dengue grave", value: 1 },
    { year: 2025, classification: "Dengue", value: 150 },
    { year: 2025, classification: "Dengue com sinais de alarme", value: 2 }
  ]);
});

test("Q1: fonte ou consulta inexistente é erro claro", () => {
  assert.throws(() => parseSinanQuery("inexistente", "yearly", tabnetHtml('"Ano";"Casos"', '"2024";1')), /Consulta inexistente/);
});
