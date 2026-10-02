import assert from "node:assert/strict";
import { test } from "node:test";
import { diffPopulation, parsePopulationCsv, toPopulationCsv } from "./population.service";

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
