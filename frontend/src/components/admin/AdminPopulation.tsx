"use client";

import { AlertTriangle, Download, FileSpreadsheet, FileUp, Save, Users, X } from "lucide-react";
import { useState } from "react";
import {
  downloadAdminPopulationCsv,
  downloadAdminPopulationModel,
  getAdminPopulation,
  previewAdminPopulation,
  saveAdminPopulation
} from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { PopulationPreviewResponse } from "@/types/api";
import { useAdminSession } from "./AdminSession";
import {
  ActionButton,
  ErrorBox,
  IDLE_ACTION,
  LoadingBlocks,
  Panel,
  StatusMessages,
  confirmAdminAction,
  downloadBlob,
  errorMessage,
  type ActionState
} from "./admin-ui";
import { useAdminLoader } from "./useAdminLoader";

type Preview = PopulationPreviewResponse & { csv: string; fileName: string };

// Exemplo da tela (números ilustrativos, não são dados de Parnaíba).
const MODEL_EXAMPLE = [
  ["2023", "150.000", "20.000"],
  ["2024", "151.200", "20.600"],
  ["2025", "152.400", "21.100"]
];

function yearsText(years: number[]) {
  return years.length === 0 ? "nenhum" : years.join(", ");
}

/** Tela de população por ano (A4): base dos indicadores por 100 mil habitantes. */
export function AdminPopulation() {
  const { handleAuthError } = useAdminSession();
  const { state, reload } = useAdminLoader(getAdminPopulation);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [sourceNote, setSourceNote] = useState("");
  const [actionState, setActionState] = useState<ActionState>(IDLE_ACTION);

  async function chooseFile(file: File | undefined) {
    if (!file) {
      return;
    }

    setActionState({ ...IDLE_ACTION, busyAction: "preview" });

    try {
      const csv = await file.text();
      setPreview({ ...(await previewAdminPopulation(csv)), csv, fileName: file.name });
      setActionState(IDLE_ACTION);
    } catch (error) {
      if (!handleAuthError(error)) {
        setActionState({ ...IDLE_ACTION, error: errorMessage(error, "Falha ao ler a planilha.") });
      }
    }
  }

  async function save() {
    if (!preview || preview.errors.length > 0) {
      return;
    }

    const { removed } = preview.diff;

    if (
      removed.length > 0 &&
      !confirmAdminAction(`A planilha não tem os anos ${removed.join(", ")}. Eles serão apagados. Continuar?`)
    ) {
      return;
    }

    setActionState({ ...IDLE_ACTION, busyAction: "save" });

    try {
      await saveAdminPopulation(preview.csv, sourceNote);
      setPreview(null);
      await reload();
      setActionState({ ...IDLE_ACTION, message: `População gravada: ${preview.rows.length} anos.` });
    } catch (error) {
      if (!handleAuthError(error)) {
        setActionState({ ...IDLE_ACTION, error: errorMessage(error, "Falha ao gravar a população.") });
      }
    }
  }

  async function download(kind: "model" | "current") {
    try {
      const { blob, filename } = kind === "model" ? await downloadAdminPopulationModel() : await downloadAdminPopulationCsv();
      downloadBlob(blob, filename);
    } catch (error) {
      if (!handleAuthError(error)) {
        setActionState({ ...IDLE_ACTION, error: errorMessage(error, "Falha ao baixar a planilha.") });
      }
    }
  }

  if (state.status === "loading") {
    return <LoadingBlocks />;
  }

  if (state.status === "error") {
    return <ErrorBox message={`API indisponível: ${state.message}`} />;
  }

  const rows = state.data.population;
  const last = rows.reduce<(typeof rows)[number] | null>(
    (latest, row) => (!latest || row.updatedAt > latest.updatedAt ? row : latest),
    null
  );
  const busy = actionState.busyAction !== null;

  return (
    <div className="space-y-5">
      <Panel
        title="Modelo da planilha"
        icon={FileSpreadsheet}
        actions={
          <ActionButton variant="primary" icon={Download} onClick={() => void download("model")}>
            Baixar modelo
          </ActionButton>
        }
      >
        <div className="grid gap-4 p-4 text-sm text-slate-700 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <p className="mb-2">
              A planilha precisa ter <strong>exatamente este formato</strong>: a primeira linha com os nomes das colunas e
              um ano por linha. O modelo já vem com os anos preenchidos; falta só digitar os números.
            </p>
            <div className="overflow-x-auto rounded border border-slate-200">
              <table className="min-w-full text-left text-sm" aria-label="Exemplo do formato da planilha">
                <thead className="bg-slate-100 font-mono text-xs text-slate-900">
                  <tr>
                    <th className="px-3 py-2 font-semibold">ano</th>
                    <th className="px-3 py-2 font-semibold">populacao</th>
                    <th className="px-3 py-2 font-semibold">populacao_60_mais</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono tabular-nums text-slate-700">
                  {MODEL_EXAMPLE.map(([year, population, elderly]) => (
                    <tr key={year}>
                      <td className="px-3 py-1.5">{year}</td>
                      <td className="px-3 py-1.5">{population}</td>
                      <td className="px-3 py-1.5">{elderly}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-xs text-slate-500">Exemplo com números ilustrativos.</p>
          </div>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>ano</strong>: quatro dígitos (2024), sem repetir anos.
            </li>
            <li>
              <strong>populacao</strong>: população residente total do ano, número inteiro. Pode usar ponto de milhar
              (153.482).
            </li>
            <li>
              <strong>populacao_60_mais</strong>: população de 60 anos ou mais. É opcional, mas sem ela a incidência em
              idosos da chikungunya fica sem valor.
            </li>
            <li>
              No Excel ou LibreOffice: <strong>Arquivo › Salvar como › CSV</strong> (separado por ponto e vírgula ou vírgula).
            </li>
            <li>
              Fonte recomendada: estimativas e censos do <strong>IBGE</strong>. O sistema não estima nem completa valores.
            </li>
          </ul>
        </div>
      </Panel>

      <Panel
        title="Enviar planilha de população"
        icon={FileUp}
        actions={
          rows.length > 0 ? (
            <ActionButton icon={Download} onClick={() => void download("current")}>
              Baixar planilha atual
            </ActionButton>
          ) : null
        }
      >
        <div className="space-y-4 p-4 text-sm text-slate-700">
          <p>
            A população de cada ano é a base dos indicadores por 100 mil habitantes. Depois de escolher o arquivo, confira a
            pré-visualização antes de gravar. <strong>A planilha substitui a tabela inteira.</strong>
          </p>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
            <div>
              <span className="mb-1 block text-xs font-medium uppercase text-slate-500">Arquivo CSV</span>
              {/* Botão próprio em português: o do navegador mostra "Choose File" conforme o idioma dele. */}
              <label className="flex items-center gap-3">
                <span
                  className={`inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded bg-institutional-600 px-3 text-sm font-medium text-white hover:bg-institutional-800 ${busy ? "pointer-events-none opacity-50" : ""}`}
                >
                  <FileUp size={16} aria-hidden="true" />
                  Escolher arquivo
                </span>
                <span className="min-w-0 truncate text-sm text-slate-600">{preview?.fileName ?? "Nenhum arquivo escolhido"}</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  disabled={busy}
                  onChange={(event) => {
                    void chooseFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                  className="sr-only"
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase text-slate-500">Fonte dos dados</span>
              <input
                type="text"
                value={sourceNote}
                maxLength={200}
                onChange={(event) => setSourceNote(event.target.value)}
                placeholder="Ex.: IBGE, estimativas da população residente"
                className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-institutional-600 focus:ring-2 focus:ring-institutional-50"
              />
            </label>
          </div>
        </div>

        {preview ? (
          <div className="space-y-3 border-t border-slate-200 p-4 text-sm">
            <p className="font-semibold text-slate-950">Pré-visualização de “{preview.fileName}”</p>
            {preview.errors.length > 0 ? (
              <div role="alert" className="rounded border border-pet-red/30 bg-pet-red/5 p-3 text-pet-red-text">
                <p className="font-medium">A planilha tem erros e não pode ser gravada:</p>
                <ul className="mt-1 list-disc pl-5">
                  {preview.errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <>
              <p className="text-slate-700">
                Colunas reconhecidas: ano = <strong>“{preview.columns.year}”</strong>, população ={" "}
                <strong>“{preview.columns.population}”</strong>, 60 anos ou mais ={" "}
                <strong>{preview.columns.population60Plus ? `“${preview.columns.population60Plus}”` : "não encontrada"}</strong>
              </p>
              <ul className="grid gap-1 text-slate-700 sm:grid-cols-2">
                <li>Anos na planilha: <strong>{preview.rows.length}</strong> ({preview.rows[0]?.year}–{preview.rows[preview.rows.length - 1]?.year})</li>
                <li>Novos: {yearsText(preview.diff.added)}</li>
                <li>Alterados: {yearsText(preview.diff.changed)}</li>
                <li className={preview.diff.removed.length ? "font-medium text-pet-red-text" : ""}>Serão apagados: {yearsText(preview.diff.removed)}</li>
              </ul>
              </>
            )}
            {preview.warnings.length > 0 ? (
              <div role="status" className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-900">
                <p className="flex items-center gap-2 font-medium">
                  <AlertTriangle size={16} aria-hidden="true" />
                  Atenção (dá para gravar, mas confira):
                </p>
                <ul className="mt-1 list-disc pl-5">
                  {preview.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <ActionButton variant="primary" icon={Save} onClick={() => void save()} disabled={busy || preview.errors.length > 0}>
                {actionState.busyAction === "save" ? "Gravando..." : "Gravar população"}
              </ActionButton>
              <ActionButton icon={X} onClick={() => setPreview(null)} disabled={busy}>
                Cancelar
              </ActionButton>
            </div>
          </div>
        ) : null}
        <StatusMessages actionState={actionState} />
      </Panel>

      <Panel title="População cadastrada" icon={Users}>
        {rows.length === 0 ? (
          <div className="p-4 text-sm text-slate-600">
            Nenhuma população cadastrada. Sem ela, os indicadores por 100 mil habitantes aparecem como “sem população”.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-pet-dark text-xs uppercase text-white">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Ano</th>
                    <th className="px-4 py-3 font-semibold">População</th>
                    <th className="px-4 py-3 font-semibold">60 anos ou mais</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.year}>
                      <td className="px-4 py-2 font-medium text-slate-950">{row.year}</td>
                      <td className="px-4 py-2 tabular-nums text-slate-900">{formatNumber(row.population)}</td>
                      <td className="px-4 py-2 tabular-nums text-slate-700">
                        {row.population60Plus === null ? "-" : formatNumber(row.population60Plus)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {last ? (
              <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
                Enviada por {last.updatedBy ?? "-"} em {formatDateTime(last.updatedAt)}
                {last.sourceNote ? ` · Fonte: ${last.sourceNote}` : ""}
              </p>
            ) : null}
          </>
        )}
      </Panel>
    </div>
  );
}
