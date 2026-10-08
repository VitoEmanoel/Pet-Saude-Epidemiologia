import type {
  AdminAuditLogsResponse,
  AdminAuthResponse,
  AdminPermission,
  AdminRole,
  AdminUser,
  AdminUserWithTemporaryPassword,
  AdminLoginPayload,
  AdminSyncAllResponse,
  AdminSyncHistoryResponse,
  SourceHealthResponse,
  PopulationPreviewResponse,
  PopulationResponse,
  IndicatorsResponse,
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

export class ApiRequestError extends Error {
  status: number;
  code: string | null;

  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function fetchAdminJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    cache: "no-store",
    credentials: "include",
    headers: {
      ...options.headers
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      typeof body?.error?.message === "string"
        ? body.error.message
        : `API request failed: ${response.status}`;
    throw new ApiRequestError(response.status, message, body?.error?.code ?? null);
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

export function getYearlyEvolution(slug: string, filters: RecordFilters = {}) {
  return fetchJson<ChartResponse<ChartPoint>>(
    `/api/charts/yearly-evolution?${buildSearchParams({ ...filters, source: slug })}`
  );
}

export function getChartBySex(slug: string, filters: RecordFilters = {}) {
  return fetchJson<ChartResponse<CategoryPoint>>(
    `/api/charts/by-sex?${buildSearchParams({ ...filters, source: slug })}`
  );
}

export function getChartByAgeGroup(slug: string, filters: RecordFilters = {}) {
  return fetchJson<ChartResponse<CategoryPoint>>(
    `/api/charts/by-age-group?${buildSearchParams({ ...filters, source: slug })}`
  );
}

export function getChartByRaceColor(slug: string, filters: RecordFilters = {}) {
  return fetchJson<ChartResponse<CategoryPoint>>(
    `/api/charts/by-race-color?${buildSearchParams({ ...filters, source: slug })}`
  );
}

export function getIndicators(slug: string) {
  return fetchJson<IndicatorsResponse>(`/api/indicators?source=${encodeURIComponent(slug)}`);
}

export function getRecords(filters: RecordFilters) {
  return fetchJson<RecordsResponse>(`/api/records?${buildSearchParams(filters)}`);
}

export function loginAdmin(payload: AdminLoginPayload) {
  return fetchAdminJson<AdminAuthResponse>("/api/admin/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

export function getAdminSession() {
  return fetchAdminJson<AdminAuthResponse>("/api/admin/auth/me");
}

const jsonRequest = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: body === undefined ? {} : { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body)
});

/** Troca da própria senha (7.4). */
export function changeOwnAdminPassword(currentPassword: string, newPassword: string) {
  return fetchAdminJson<{ changed: boolean }>("/api/admin/account/password", jsonRequest("POST", { currentPassword, newPassword }));
}

export function getAdminUsers() {
  return fetchAdminJson<{ users: AdminUser[] }>("/api/admin/users");
}

export function createAdminUser(payload: { username: string; name: string; role: AdminRole; permissions: AdminPermission[] }) {
  return fetchAdminJson<AdminUserWithTemporaryPassword>("/api/admin/users", jsonRequest("POST", payload));
}

export function updateAdminUser(id: number, payload: Partial<Pick<AdminUser, "name" | "role" | "permissions" | "active">>) {
  return fetchAdminJson<{ user: AdminUser }>(`/api/admin/users/${id}`, jsonRequest("PATCH", payload));
}

export function resetAdminUserPassword(id: number) {
  return fetchAdminJson<AdminUserWithTemporaryPassword>(`/api/admin/users/${id}/reset-password`, jsonRequest("POST"));
}

export function deleteAdminUser(id: number) {
  return fetchAdminJson<{ deleted: boolean }>(`/api/admin/users/${id}`, jsonRequest("DELETE"));
}

export function logoutAdmin() {
  return fetchAdminJson<AdminAuthResponse>("/api/admin/auth/logout", {
    method: "POST"
  });
}

export function getAdminSyncHistory() {
  return fetchAdminJson<AdminSyncHistoryResponse>("/api/admin/sync-history");
}

export function getAdminSourceHealth() {
  return fetchAdminJson<SourceHealthResponse>("/api/admin/source-health");
}

export function getAdminPopulation() {
  return fetchAdminJson<PopulationResponse>("/api/admin/population");
}

export function previewAdminPopulation(csv: string) {
  return fetchAdminJson<PopulationPreviewResponse>("/api/admin/population/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ csv })
  });
}

export function saveAdminPopulation(csv: string, sourceNote: string) {
  return fetchAdminJson<PopulationResponse>("/api/admin/population", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ csv, sourceNote })
  });
}

export async function downloadAdminPopulationCsv() {
  const response = await fetchAdminResponse("/api/admin/population/template.csv");
  return { blob: await response.blob(), filename: "populacao-parnaiba.csv" };
}

/** Modelo em branco (um ano por linha) para preencher e enviar. */
export async function downloadAdminPopulationModel() {
  const response = await fetchAdminResponse("/api/admin/population/model.csv");
  return { blob: await response.blob(), filename: "modelo-populacao-parnaiba.csv" };
}

export async function downloadAdminIndicatorsCsv(slug: string) {
  const response = await fetchAdminResponse(`/api/admin/indicators/export.csv?source=${encodeURIComponent(slug)}`);
  return { blob: await response.blob(), filename: `indicadores-${slug}.csv` };
}

export function getAdminAuditLogs() {
  return fetchAdminJson<AdminAuditLogsResponse>("/api/admin/audit-logs");
}

export function runAdminSyncSource(slug: string) {
  return fetchAdminJson<AdminSyncResult>(`/api/admin/sync/${slug}`, {
    method: "POST"
  });
}

export function runAdminSyncAll() {
  return fetchAdminJson<AdminSyncAllResponse>("/api/admin/sync-all", {
    method: "POST"
  });
}

export async function downloadAdminRecordsCsv(filters: RecordFilters) {
  const response = await fetchAdminResponse(
    `/api/admin/records/export.csv?${buildSearchParams(filters)}`
  );

  const blob = await response.blob();
  const contentDisposition = response.headers.get("content-disposition") ?? "";
  const match = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);

  return {
    blob,
    filename: match?.[1] ?? "registros-epidemiologicos-parnaiba.csv"
  };
}

export async function downloadAdminDashboardHtml(filters: RecordFilters) {
  const response = await fetchAdminResponse(
    `/api/admin/dashboard/export.html?${buildSearchParams(filters)}`
  );

  const blob = await response.blob();
  const contentDisposition = response.headers.get("content-disposition") ?? "";
  const match = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);

  return {
    blob,
    filename: match?.[1] ?? "dashboard-epidemiologico-parnaiba.html"
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
  options: RequestInit = {}
): Promise<Response> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    cache: "no-store",
    credentials: "include",
    headers: {
      ...options.headers
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      typeof body?.error?.message === "string"
        ? body.error.message
        : `API request failed: ${response.status}`;
    throw new ApiRequestError(response.status, message, body?.error?.code ?? null);
  }

  return response;
}
