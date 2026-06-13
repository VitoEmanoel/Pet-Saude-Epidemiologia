import type {
  CategoryPoint,
  ChartPoint,
  ChartResponse,
  DashboardOverviewResponse,
  RecordFilters,
  RecordsResponse,
  SourceFiltersResponse,
  SourceSummaryResponse,
  SourcesResponse
} from "@/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getSources() {
  return fetchJson<SourcesResponse>("/api/sources");
}

export function getDashboardOverview() {
  return fetchJson<DashboardOverviewResponse>("/api/dashboard/overview");
}

export function getSourceSummary(slug: string) {
  return fetchJson<SourceSummaryResponse>(`/api/sources/${slug}/summary`);
}

export function getSourceFilters(slug: string) {
  return fetchJson<SourceFiltersResponse>(`/api/sources/${slug}/filters`);
}

export function getYearlyEvolution(slug: string) {
  return fetchJson<ChartResponse<ChartPoint>>(`/api/charts/yearly-evolution?source=${slug}`);
}

export function getChartBySex(slug: string) {
  return fetchJson<ChartResponse<CategoryPoint>>(`/api/charts/by-sex?source=${slug}`);
}

export function getChartByAgeGroup(slug: string) {
  return fetchJson<ChartResponse<CategoryPoint>>(`/api/charts/by-age-group?source=${slug}`);
}

export function getChartByRaceColor(slug: string) {
  return fetchJson<ChartResponse<CategoryPoint>>(`/api/charts/by-race-color?source=${slug}`);
}

export function getRecords(filters: RecordFilters) {
  return fetchJson<RecordsResponse>(`/api/records?${buildSearchParams(filters)}`);
}

export function getRecordsExportUrl(filters: RecordFilters) {
  return `${API_BASE_URL}/api/records/export.csv?${buildSearchParams(filters)}`;
}

function buildSearchParams(filters: RecordFilters) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  return params.toString();
}
