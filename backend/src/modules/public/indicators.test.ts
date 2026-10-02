import assert from "node:assert/strict";
import { test } from "node:test";
import { parseClassificationCounts } from "../datasus/sinan-tabnet.collector";
import { ratio } from "./indicators.service";

test("A5: incidência = casos ÷ população × 100 mil, com 2 casas", () => {
  assert.deepEqual(ratio(2022, 2075, 162159, 100_000, "sem_populacao", 2026), {
    year: 2022,
    value: 1279.61,
    numerator: 2075,
    denominator: 162159,
    status: "ok",
    provisional: false
  });
});

test("A5: sem população não estima; ano corrente é provisório", () => {
  assert.equal(ratio(2023, 752, null, 100_000, "sem_populacao", 2026).status, "sem_populacao");
  assert.equal(ratio(2023, 752, null, 100_000, "sem_populacao", 2026).value, null);
  assert.equal(ratio(2026, 969, 165000, 100_000, "sem_populacao", 2026).provisional, true);
});

test("A5: lê a tabela ano × classificação do TABNET (sem a coluna Total)", () => {
  const html = `<PRE>"Ano 1º Sintoma(s)";"Ign/Branco";"Dengue";"Dengue com sinais de alarme";"Dengue grave";"Total"
"2024";-;467;42;1;510
"2025";-;132;20;-;152
"Total";-;599;62;1;662
&</PRE>`;
  assert.deepEqual(parseClassificationCounts(html), [
    { year: 2024, classification: "Dengue", value: 467 },
    { year: 2024, classification: "Dengue com sinais de alarme", value: 42 },
    { year: 2024, classification: "Dengue grave", value: 1 },
    { year: 2025, classification: "Dengue", value: 132 },
    { year: 2025, classification: "Dengue com sinais de alarme", value: 20 }
  ]);
});
