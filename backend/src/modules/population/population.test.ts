import assert from "node:assert/strict";
import { test } from "node:test";
import { diffPopulation, parsePopulationCsv, toPopulationCsv, toPopulationTemplateCsv } from "./population.service";

test("A4: lê planilha do Excel em português (ponto e vírgula, ponto de milhar, BOM)", () => {
  const result = parsePopulationCsv("﻿ano;populacao;populacao_60_mais\r\n2022;162.159;18.200\r\n2021;153 482;\r\n\r\n");
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.rows, [
    { year: 2021, population: 153482, population60Plus: null },
    { year: 2022, population: 162159, population60Plus: 18200 }
  ]);
});

test("A4: aceita vírgula como separador e sem a coluna de idosos", () => {
  const result = parsePopulationCsv("ano,populacao\n2020,153000");
  assert.deepEqual(result.rows, [{ year: 2020, population: 153000, population60Plus: null }]);
});

test("A4: recusa cabeçalho errado, ano repetido, valores inválidos e idosos > total", () => {
  assert.match(parsePopulationCsv("year;pop\n2020;1").errors[0], /Cabeçalho inválido/);
  const result = parsePopulationCsv(
    "ano;populacao;populacao_60_mais\n20x0;1\n2020;153000\n2020;153001\n2021;-5\n2022;1,5\n2023;100;200\n1900;10"
  );
  assert.equal(result.rows.length, 1);
  assert.equal(result.errors.length, 6);
  assert.match(result.errors.join(" "), /ano inválido.*mais de uma vez.*população inválida.*população inválida.*maior que a população total.*ano inválido/);
  assert.match(parsePopulationCsv("").errors[0], /vazia/);
});

test("A4: mostra o que muda em relação à tabela atual e gera o modelo", () => {
  const current = [
    { year: 2020, population: 100, population60Plus: null },
    { year: 2021, population: 200, population60Plus: null }
  ];
  const next = [
    { year: 2021, population: 210, population60Plus: null },
    { year: 2022, population: 300, population60Plus: 30 }
  ];
  assert.deepEqual(diffPopulation(current, next), { added: [2022], changed: [2021], removed: [2020], unchanged: [] });
  assert.equal(toPopulationCsv(next), "ano;populacao;populacao_60_mais\n2021;210;\n2022;300;30\n");
});

test("Planilha: reconhece nomes de coluna com acento, maiúsculas e variações de 60+", () => {
  for (const header of [
    "Ano;População;População 60+",
    "ANO;POPULACAO_TOTAL;60 anos ou mais",
    "ano;habitantes;idosos",
    "Ano;Pop;Pop. 60 e mais"
  ]) {
    const result = parsePopulationCsv(`${header}\n2022;162.159;18.200`);
    assert.deepEqual(result.errors, [], header);
    assert.deepEqual(result.rows, [{ year: 2022, population: 162159, population60Plus: 18200 }], header);
    assert.deepEqual(result.warnings, [], header);
  }
});

test("Planilha: avisa coluna ignorada, falta de 60+ e coluna de 60+ vazia (sem impedir gravar)", () => {
  const extra = parsePopulationCsv("ano;populacao;fonte\n2022;162159;IBGE");
  assert.deepEqual(extra.errors, []);
  assert.match(extra.warnings.join(" "), /"fonte" não foi reconhecida.*não tem a coluna de população de 60 anos/);
  assert.deepEqual(extra.columns, { year: "ano", population: "populacao", population60Plus: null });

  const empty = parsePopulationCsv("ano;populacao;populacao_60_mais\n2022;162159;\n2023;162200;");
  assert.match(empty.warnings.join(" "), /"populacao_60_mais" está vazia em todos os anos/);
});

test("Planilha: duas colunas de população é erro (não escolhe sozinho)", () => {
  const result = parsePopulationCsv("ano;populacao;habitantes\n2022;1;2");
  assert.equal(result.rows.length, 0);
  assert.match(result.errors[0], /Duas colunas parecem ser a de população/);
});

test("Planilha: modelo tem um ano por linha em branco e, enviado sem preencher, é recusado", () => {
  const model = toPopulationTemplateCsv(2007, 2009);
  assert.equal(model, "ano;populacao;populacao_60_mais\n2007;;\n2008;;\n2009;;\n");
  const result = parsePopulationCsv(model);
  assert.equal(result.rows.length, 0);
  assert.equal(result.errors.length, 3);
  assert.match(result.errors[0], /Linha 2: população inválida/);
});
