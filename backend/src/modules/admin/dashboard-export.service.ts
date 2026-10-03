import type { ALLOWED_CITY } from "../../config/city";
import type { AllowedSource } from "../../config/sources";
import type { PublicFilters } from "../public/public-data.service";

type ChartPoint = {
  year: number;
  value: number;
};

type CategoryPoint = {
  label: string;
  value: number;
};

type DashboardExportInput = {
  generatedAt: Date;
  city: typeof ALLOWED_CITY;
  source: AllowedSource;
  filters: PublicFilters;
  summary: {
    totalRecords: number;
    totalCases: number;
    firstAvailableYear: number | null;
    lastAvailableYear: number | null;
    latestYear: number | null;
    latestYearValue: number | null;
    lastUpdate: Date | null;
    lastSyncStatus: string | null;
    municipalityDataAvailable: boolean;
    availabilityStatus: string | null;
  };
  charts: {
    yearly: ChartPoint[];
    bySex: CategoryPoint[];
    byAgeGroup: CategoryPoint[];
    byRaceColor: CategoryPoint[];
  };
};

export function dashboardExportFilename(sourceSlug: string): string {
  return `dashboard-epidemiologico-${sanitizeFilename(sourceSlug)}.html`;
}

export function toDashboardHtml(input: DashboardExportInput): string {
  const sourceUrl = getSourceReferenceUrl(input.source.sourceUrl);
  const filters = getVisibleFilters(input.filters);
  const yearRange = formatYearRange(
    input.summary.firstAvailableYear,
    input.summary.lastAvailableYear
  );

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.source.name)} - Painel epidemiológico</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #000000;
      --muted: #143A60;
      --line: #E2E0E0;
      --panel: #ffffff;
      --soft: #E2E0E0;
      --green: #066F9B;
      --blue: #143A60;
      --amber: #E8531E;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #E2E0E0;
      color: var(--ink);
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.45;
    }
    .page {
      max-width: 1180px;
      margin: 0 auto;
      padding: 32px;
    }
    header {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      align-items: flex-start;
      background: #143A60;
      color: #ffffff;
      border-bottom: 4px solid #E8531E;
      padding: 20px;
      margin-bottom: 24px;
    }
    header p { color: #ffffff; opacity: 0.82; }
    header a { color: #ffffff; }
    h1 {
      margin: 0;
      font-size: 30px;
      line-height: 1.15;
      letter-spacing: 0;
    }
    h2 {
      margin: 0 0 14px;
      font-size: 16px;
      letter-spacing: 0;
    }
    p {
      margin: 6px 0 0;
      color: var(--muted);
      font-size: 14px;
    }
    a { color: var(--blue); }
    .print-button {
      border: 1px solid #459CD7;
      background: #066F9B;
      color: #ffffff;
      height: 38px;
      padding: 0 14px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
    }
    .meta {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 18px;
    }
    .meta-item,
    .card,
    .chart {
      border: 1px solid var(--line);
      background: var(--panel);
    }
    .meta-item {
      padding: 10px 12px;
      font-size: 13px;
    }
    .label {
      display: block;
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
      margin: 18px 0 24px;
    }
    .card {
      padding: 14px;
      min-height: 102px;
      border-top: 4px solid #066F9B;
    }
    .card strong {
      display: block;
      font-size: 26px;
      line-height: 1.15;
      margin-top: 8px;
      word-break: break-word;
    }
    .card small {
      display: block;
      color: var(--muted);
      font-size: 12px;
      margin-top: 6px;
    }
    .charts {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }
    .chart {
      padding: 16px;
      min-width: 0;
    }
    svg {
      display: block;
      width: 100%;
      height: auto;
    }
    .empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 220px;
      border: 1px dashed var(--line);
      color: var(--muted);
      font-size: 14px;
    }
    footer {
      margin-top: 24px;
      color: var(--muted);
      font-size: 12px;
    }
    @media (max-width: 900px) {
      .page { padding: 18px; }
      header { flex-direction: column; }
      .meta { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .charts { grid-template-columns: 1fr; }
    }
    @media print {
      body { background: #ffffff; }
      .page { max-width: none; padding: 0; }
      .print-button { display: none; }
      .chart, .card, .meta-item { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main class="page">
    <header>
      <div>
        <h1>${escapeHtml(input.source.name)}</h1>
        <p>Painel epidemiológico de ${escapeHtml(input.city.name)} - ${escapeHtml(input.city.uf)}</p>
        ${sourceUrl ? `<p>Fonte oficial: <a href="${escapeHtml(sourceUrl)}">${escapeHtml(sourceUrl)}</a></p>` : ""}
      </div>
      <button class="print-button" type="button" onclick="window.print()">Imprimir / salvar PDF</button>
    </header>

    <section class="meta" aria-label="Dados da exportação">
      <div class="meta-item"><span class="label">Sistema</span>${escapeHtml(input.source.system)}</div>
      <div class="meta-item"><span class="label">Município</span>${escapeHtml(input.city.name)} - ${escapeHtml(input.city.uf)}</div>
      <div class="meta-item"><span class="label">Filtros</span>${escapeHtml(filters)}</div>
      <div class="meta-item"><span class="label">Gerado em</span>${escapeHtml(formatDateTime(input.generatedAt))}</div>
    </section>

    <section class="cards" aria-label="Indicadores">
      ${metricCard("Casos", formatNumber(input.summary.totalCases), "Total consolidado")}
      ${metricCard("Último ano", formatNumber(input.summary.latestYearValue ?? 0), String(input.summary.latestYear ?? "-"))}
      ${metricCard("Registros", formatNumber(input.summary.totalRecords), "No banco de dados")}
      ${metricCard("Período", yearRange, "Anos disponíveis")}
      ${metricCard("Atualização", formatSyncStatus(input.summary.lastSyncStatus), formatDateTime(input.summary.lastUpdate))}
    </section>

    <section class="charts" aria-label="Gráficos">
      ${chartPanel("Evolução anual", lineChart(input.charts.yearly))}
      ${chartPanel("Por sexo", barChart(input.charts.bySex))}
      ${chartPanel("Por raça/cor", barChart(input.charts.byRaceColor))}
      ${chartPanel("Por faixa etária", barChart(input.charts.byAgeGroup))}
    </section>

    <footer>
      Arquivo gerado pelo painel administrativo. Os dados sao os registros ja consolidados no banco local do sistema.
    </footer>
  </main>
</body>
</html>`;
}

function metricCard(label: string, value: string, detail: string): string {
  return `<article class="card"><span class="label">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></article>`;
}

function chartPanel(title: string, chart: string): string {
  return `<article class="chart"><h2>${escapeHtml(title)}</h2>${chart}</article>`;
}

function lineChart(points: ChartPoint[]): string {
  if (points.length === 0) {
    return emptyChart();
  }

  const width = 760;
  const height = 300;
  const paddingLeft = 56;
  const paddingRight = 18;
  const paddingTop = 24;
  const paddingBottom = 44;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const xStep = points.length > 1 ? chartWidth / (points.length - 1) : 0;

  const coordinates = points.map((point, index) => {
    const x = paddingLeft + index * xStep;
    const y = paddingTop + chartHeight - (point.value / maxValue) * chartHeight;
    return { ...point, x, y };
  });
  const path = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const labelIndexes = getLabelIndexes(points.length);

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfico de evolução anual">
    <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${paddingTop + chartHeight}" stroke="#E2E0E0" />
    <line x1="${paddingLeft}" y1="${paddingTop + chartHeight}" x2="${paddingLeft + chartWidth}" y2="${paddingTop + chartHeight}" stroke="#E2E0E0" />
    <text x="0" y="${paddingTop + 4}" font-size="12" fill="#143A60">${escapeHtml(formatNumber(maxValue))}</text>
    <text x="0" y="${paddingTop + chartHeight}" font-size="12" fill="#143A60">0</text>
    <polyline points="${path}" fill="none" stroke="#066F9B" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
    ${coordinates
      .map(
        (point) =>
          `<circle cx="${point.x}" cy="${point.y}" r="4" fill="#E8531E"><title>${point.year}: ${formatNumber(point.value)}</title></circle>`
      )
      .join("")}
    ${labelIndexes
      .map((index) => {
        const point = coordinates[index];
        return `<text x="${point.x}" y="${height - 14}" font-size="12" text-anchor="middle" fill="#143A60">${point.year}</text>`;
      })
      .join("")}
  </svg>`;
}

function barChart(points: CategoryPoint[]): string {
  if (points.length === 0) {
    return emptyChart();
  }

  const width = 760;
  const rowHeight = 34;
  const paddingTop = 16;
  const paddingBottom = 20;
  const labelWidth = 190;
  const valueWidth = 86;
  const barWidth = width - labelWidth - valueWidth - 34;
  const height = paddingTop + paddingBottom + points.length * rowHeight;
  const maxValue = Math.max(...points.map((point) => point.value), 1);

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfico de barras">
    ${points
      .map((point, index) => {
        const y = paddingTop + index * rowHeight;
        const visibleBarWidth = Math.max(2, (point.value / maxValue) * barWidth);

        return `<g>
          <text x="0" y="${y + 20}" font-size="12" fill="#143A60">${escapeHtml(point.label)}</text>
          <rect x="${labelWidth}" y="${y + 6}" width="${barWidth}" height="16" fill="#E2E0E0" />
          <rect x="${labelWidth}" y="${y + 6}" width="${visibleBarWidth}" height="16" fill="#066F9B" />
          <text x="${labelWidth + barWidth + 12}" y="${y + 20}" font-size="12" fill="#000000">${escapeHtml(formatNumber(point.value))}</text>
        </g>`;
      })
      .join("")}
  </svg>`;
}

function emptyChart(): string {
  return `<div class="empty">Sem dados para os filtros selecionados.</div>`;
}

function getLabelIndexes(length: number): number[] {
  if (length <= 8) {
    return Array.from({ length }, (_item, index) => index);
  }

  const indexes = new Set<number>();
  const parts = 7;

  for (let index = 0; index <= parts; index += 1) {
    indexes.add(Math.round((index * (length - 1)) / parts));
  }

  return [...indexes].sort((left, right) => left - right);
}

function getVisibleFilters(filters: PublicFilters): string {
  const values = [
    filters.year ? `Ano ${filters.year}` : null,
    filters.sex ? `Sexo ${filters.sex}` : null,
    filters.ageGroup ? `Faixa etária ${filters.ageGroup}` : null,
    filters.raceColor ? `Raca/cor ${filters.raceColor}` : null,
    filters.condition ? `Condicao ${filters.condition}` : null
  ].filter(Boolean);

  return values.length > 0 ? values.join(" | ") : "Todos";
}

function getSourceReferenceUrl(sourceUrl: string | null): string | null {
  if (!sourceUrl) {
    return null;
  }

  if (sourceUrl.startsWith("http://tabnet.datasus.gov.br")) {
    return sourceUrl.replace("http://tabnet.datasus.gov.br", "https://tabnet.datasus.gov.br");
  }

  return sourceUrl;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatDateTime(value: Date | string | null): string {
  if (!value) {
    return "-";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function formatYearRange(start: number | null, end: number | null): string {
  if (!start && !end) {
    return "-";
  }

  if (start === end) {
    return String(start ?? end);
  }

  return `${start ?? "-"}-${end ?? "-"}`;
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "dashboard";
}

const SYNC_STATUS_LABELS: Record<string, string> = {
  SUCCESS: "Atualizado",
  FAILED: "Falha na atualização",
  RUNNING: "Atualizando",
  UNAVAILABLE: "Indisponível"
};

function formatSyncStatus(status: string | null | undefined) {
  return status ? SYNC_STATUS_LABELS[status] ?? status : "Sem status";
}

