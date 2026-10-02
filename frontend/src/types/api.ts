export type City = {
  name: string;
  state: string;
  uf: string;
  ibgeCode: string;
};

export type MunicipalityFilterStatus = "unknown" | "available" | "unavailable";
export type SourceKind = "primary" | "derived" | "internal";

export type DataSource = {
  slug: string;
  name: string;
  system: string;
  category: string;
  municipalityFilterStatus: MunicipalityFilterStatus;
  sourceUrl: string | null;
  active: boolean;
  syncEnabled: boolean;
  kind: SourceKind;
};

export type ChartPoint = {
  year: number;
  value: number;
};

export type CategoryPoint = {
  label: string;
  value: number;
};

export type SourcesResponse = {
  city: City;
  category: string;
  total: number;
  sources: DataSource[];
};

export type DashboardOverviewResponse = {
  city: City;
  summary: {
    totalRecords: number;
    totalCases: number;
    lastUpdate: string | null;
    totalSources: number;
    sourcesWithMunicipalData: number;
    sourcesWithoutMunicipalData: number;
    sourcesPendingValidation: number;
    dataStatus: string;
    // Quantas doenças entram na soma de totalCases (fontes primárias públicas)
    casesSourceCount: number;
  };
  casesBySource: Array<{
    slug: string;
    name: string;
    kind: "primary" | "derived" | "internal";
    totalCases: number;
    firstYear: number | null;
    lastYear: number | null;
  }>;
  charts: {
    yearlyEvolution: ChartPoint[];
  };
};

export type SourceSummaryResponse = {
  city: City;
  source: DataSource;
  summary: {
    totalRecords: number;
    totalCases: number;
    firstAvailableYear: number | null;
    lastAvailableYear: number | null;
    latestYear: number | null;
    latestYearValue: number | null;
    lastUpdate: string | null;
    lastSyncStatus: string | null;
    municipalityDataAvailable: boolean;
    availabilityStatus: string | null;
  };
};

export type SourceFiltersResponse = {
  city: City;
  source: DataSource;
  filters: {
    years: number[];
    sex: string[];
    ageGroups: string[];
    raceColors: string[];
    conditions: string[];
    metrics: string[];
  };
};

export type DemographicFilterKey = "sex" | "ageGroup" | "raceColor";

export type ChartResponse<TPoint> = {
  city: City;
  source: DataSource;
  series: TPoint[];
  // Filtros de outras dimensões que o gráfico não consegue aplicar (o DATASUS não cruza dimensões)
  ignoredFilters?: DemographicFilterKey[];
};

export type EpidemiologicalRecord = {
  id: number;
  source: {
    slug: string;
    name: string;
    system: string;
  };
  city: City;
  year: number | null;
  month: number | null;
  diseaseOrCondition: string | null;
  metric: string | null;
  value: number | null;
  sex: string | null;
  ageGroup: string | null;
  raceColor: string | null;
  dimensions: Record<string, unknown>;
  sourceTable: string | null;
  aggregation: ResolvedAggregation | null;
  importedAt: string;
};

// Visões dos mesmos casos: total do ano, por sexo, por faixa etária, por raça/cor
export type RecordAggregation = "yearly" | "sex" | "age_group" | "race_color" | "all";
export type ResolvedAggregation = Exclude<RecordAggregation, "all">;

export type RecordsResponse = {
  city: City;
  filters: Record<string, string | number | undefined>;
  aggregation: RecordAggregation;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  records: EpidemiologicalRecord[];
};

export type RecordFilters = {
  source?: string;
  year?: number;
  sex?: string;
  ageGroup?: string;
  raceColor?: string;
  condition?: string;
  aggregation?: RecordAggregation;
  page?: number;
  pageSize?: number;
};

export type AdminSyncJob = {
  id: number;
  sourceId: number | null;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  recordsImported: number;
  errorMessage: string | null;
  requestedBy: string | null;
  createdAt: string;
  source: {
    slug: string;
    name: string;
    system: string;
  } | null;
};

export type AdminSyncHistoryResponse = {
  city: City;
  syncJobs: AdminSyncJob[];
};

export type AdminAuthResponse = {
  authenticated: boolean;
  username?: string;
};

export type AdminLoginPayload = {
  username: string;
  password: string;
};

export type AdminAuditLog = {
  id: number;
  actor: string;
  action: string;
  status: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type PopulationEstimate = {
  year: number;
  population: number;
  population60Plus: number | null;
  sourceNote: string | null;
  updatedBy: string | null;
  updatedAt: string;
};

export type PopulationResponse = {
  population: PopulationEstimate[];
};

export type PopulationDiff = {
  added: number[];
  changed: number[];
  removed: number[];
  unchanged: number[];
};

export type PopulationPreviewResponse = {
  rows: Array<Pick<PopulationEstimate, "year" | "population" | "population60Plus">>;
  errors: string[];
  diff: PopulationDiff;
};

export type SourceHealth = {
  slug: string;
  name: string;
  level: "ok" | "warning" | "error";
  consecutiveFailures: number;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  availabilityMessage: string | null;
  problems: string[];
};

export type SourceHealthResponse = {
  sources: SourceHealth[];
};

export type AdminAuditLogsResponse = {
  auditLogs: AdminAuditLog[];
};

export type AdminSyncResult = {
  city: City;
  source: {
    slug: string;
    name: string;
    system: string;
  };
  syncJob?: {
    id: number;
    status: string;
    startedAt: string | null;
    finishedAt: string | null;
    recordsImported: number;
    errorMessage: string | null;
  };
  rawImportsCreated?: number;
  error?: {
    code: string;
    message: string;
  };
};

export type AdminSyncAllResponse = {
  city: City;
  results: AdminSyncResult[];
};
