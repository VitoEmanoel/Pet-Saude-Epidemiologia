import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { listPeriodFilesInForm, newerPeriodFiles } from "./sinan-tabnet.collector";

// Formulário real salvo na validação da chikungunya (A2).
const chikungunyaForm = readFileSync(
  path.join(__dirname, "../../../../docs/evidencias/chikungunya_sinan/formulario_tabnet_chikungunya_2026-10-02.html"),
  "utf8"
);

test("D5: lê os arquivos de ano do formulário real do TABNET", () => {
  const files = listPeriodFilesInForm(chikungunyaForm, "chikbr");
  assert.equal(files.length, 13);
  assert.equal(files[0], "chikbr14.dbf");
  assert.equal(files[files.length - 1], "chikbr26.dbf");
});

test("D5: inclui só arquivos do mesmo prefixo e mais novos que o último configurado", () => {
  const configured = ["dengbr14.dbf", "dengbr25.dbf", "dengbr26.dbf"];
  const form = ["dengbr13.dbf", "dengbr26.dbf", "dengbr27.dbf", "dengbr28.dbf", "chikbr27.dbf"]
    .map((file) => `<OPTION VALUE="${file}">`)
    .join("\n");

  assert.deepEqual(newerPeriodFiles(configured, listPeriodFilesInForm(form, "dengbr")), ["dengbr27.dbf", "dengbr28.dbf"]);
  assert.deepEqual(newerPeriodFiles(configured, listPeriodFilesInForm("<html>sem opções</html>", "dengbr")), []);
  assert.deepEqual(newerPeriodFiles([], ["dengbr27.dbf"]), []);
});
