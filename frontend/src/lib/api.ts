import type {
  AdminSyncAllResponse,
  AdminSyncHistoryResponse,
  AdminSyncResult,
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

async function fetchAdminJson<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      ...options.headers,
      authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      typeof body?.error?.message === "string"
        ? body.error.message
        : `API request failed: ${response.status}`;
    throw new Error(message);
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

export function getAdminSyncHistory(token: string) {
  return fetchAdminJson<AdminSyncHistoryResponse>("/api/admin/sync-history", token);
}

export function runAdminSyncSource(slug: string, token: string) {
  return fetchAdminJson<AdminSyncResult>(`/api/admin/sync/${slug}`, token, {
    method: "POST"
  });
}

export function runAdminSyncAll(token: string) {
  return fetchAdminJson<AdminSyncAllResponse>("/api/admin/sync-all", token, {
    method: "POST"
  });
}

export async function downloadAdminRecordsCsv(filters: RecordFilters, token: string) {
  const response = await fetchAdminResponse(
    `/api/admin/records/export.csv?${buildSearchParams(filters)}`,
    token
  );

  const blob = await response.blob();
  const contentDisposition = response.headers.get("content-disposition") ?? "";
  const match = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);

  return {
    blob,
    filename: match?.[1] ?? "registros-epidemiologicos-parnaiba.csv"
  };
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

async function fetchAdminResponse(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      ...options.headers,
      authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      typeof body?.error?.message === "string"
        ? body.error.message
        : `API request failed: ${response.status}`;
    throw new Error(message);
  }

  return response;
}
