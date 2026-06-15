export type City = {
  name: string;
  state: string;
  uf: string;
  ibgeCode: string;
};

export type MunicipalityFilterStatus = "unknown" | "available" | "unavailable";

export type DataSource = {
  slug: string;
  name: string;
  system: string;
  category: string;
  municipalityFilterStatus: MunicipalityFilterStatus;
  sourceUrl: string | null;
  active: boolean;
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
  };
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

export type ChartResponse<TPoint> = {
  city: City;
  source: DataSource;
  series: TPoint[];
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
  importedAt: string;
};

export type RecordsResponse = {
  city: City;
  filters: Record<string, string | number | undefined>;
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
