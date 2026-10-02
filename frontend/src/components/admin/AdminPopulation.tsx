"use client";

import { Download, FileUp, Save, Users, X } from "lucide-react";
import { useState } from "react";
import { downloadAdminPopulationCsv, getAdminPopulation, previewAdminPopulation, saveAdminPopulation } from "@/lib/api";
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

  async function downloadCurrent() {
    try {
      const { blob, filename } = await downloadAdminPopulationCsv();
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
        title="Enviar planilha de população"
        icon={FileUp}
        actions={
          <ActionButton icon={Download} onClick={() => void downloadCurrent()}>
            {rows.length > 0 ? "Baixar planilha atual" : "Baixar modelo"}
          </ActionButton>
        }
      >
        <div className="space-y-4 p-4 text-sm text-slate-700">
          <p>
            A população residente de cada ano é a base dos indicadores por 100 mil habitantes. Envie um arquivo{" "}
            <strong>CSV</strong> com as colunas <code>ano</code>, <code>populacao</code> e, se tiver,{" "}
            <code>populacao_60_mais</code> (para a incidência em idosos). Pode usar <code>;</code> ou <code>,</code>{" "}
            como separador e ponto de milhar (153.482). <strong>A planilha substitui a tabela inteira.</strong>
          </p>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase text-slate-500">Arquivo CSV</span>
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={busy}
                onChange={(event) => {
                  void chooseFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
                className="block w-full text-sm text-slate-700 file:mr-3 file:h-10 file:rounded file:border-0 file:bg-institutional-600 file:px-3 file:text-sm file:font-medium file:text-white"
              />
            </label>
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
              <div role="alert" className="rounded border border-pet-red/30 bg-pet-red/5 p-3 text-pet-red">
                <p className="font-medium">A planilha tem erros e não pode ser gravada:</p>
                <ul className="mt-1 list-disc pl-5">
                  {preview.errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <ul className="grid gap-1 text-slate-700 sm:grid-cols-2">
                <li>Anos na planilha: <strong>{preview.rows.length}</strong> ({preview.rows[0]?.year}–{preview.rows[preview.rows.length - 1]?.year})</li>
                <li>Novos: {yearsText(preview.diff.added)}</li>
                <li>Alterados: {yearsText(preview.diff.changed)}</li>
                <li className={preview.diff.removed.length ? "font-medium text-pet-red" : ""}>Serão apagados: {yearsText(preview.diff.removed)}</li>
              </ul>
            )}
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
