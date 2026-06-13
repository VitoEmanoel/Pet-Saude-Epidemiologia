import { ALLOWED_DATASUS_CATEGORY } from "./city";

export type MunicipalityFilterStatus = "unknown" | "available" | "unavailable";

export type AllowedSource = {
  slug: string;
  name: string;
  system: string;
  category: typeof ALLOWED_DATASUS_CATEGORY;
  municipalityFilterStatus: MunicipalityFilterStatus;
  sourceUrl: string | null;
  active: boolean;
};

export const allowedSources: readonly AllowedSource[] = [
  {
    slug: "morbidade_hospitalar_sih_sus",
    name: "Morbidade Hospitalar do SUS",
    system: "SIH/SUS",
    category: ALLOWED_DATASUS_CATEGORY,
    municipalityFilterStatus: "unknown",
    sourceUrl: null,
    active: true
  },
  {
    slug: "aids_sinan",
    name: "Casos de Aids",
    system: "SINAN",
    category: ALLOWED_DATASUS_CATEGORY,
    municipalityFilterStatus: "unknown",
    sourceUrl: null,
    active: true
  },
  {
    slug: "hanseniase_sinan",
    name: "Casos de Hanseníase",
    system: "SINAN",
    category: ALLOWED_DATASUS_CATEGORY,
    municipalityFilterStatus: "unknown",
    sourceUrl: null,
    active: true
  },
  {
    slug: "tuberculose_sinan",
    name: "Casos de Tuberculose",
    system: "SINAN",
    category: ALLOWED_DATASUS_CATEGORY,
    municipalityFilterStatus: "available",
    sourceUrl: "http://tabnet.datasus.gov.br/cgi/deftohtm.exe?sinannet/cnv/tubercbr.def",
    active: true
  },
  {
    slug: "agravos_notificacao_2007",
    name: "Doenças e Agravos de Notificação - 2007 em diante",
    system: "SINAN",
    category: ALLOWED_DATASUS_CATEGORY,
    municipalityFilterStatus: "unknown",
    sourceUrl: null,
    active: true
  },
  {
    slug: "agravos_notificacao_2001_2006",
    name: "Doenças e Agravos de Notificação - 2001 a 2006",
    system: "SINAN",
    category: ALLOWED_DATASUS_CATEGORY,
    municipalityFilterStatus: "unknown",
    sourceUrl: null,
    active: true
  },
  {
    slug: "scz_2015",
    name: "Notificações de casos suspeitos de SCZ",
    system: "SCZ",
    category: ALLOWED_DATASUS_CATEGORY,
    municipalityFilterStatus: "unknown",
    sourceUrl: null,
    active: true
  },
  {
    slug: "pce_esquistossomose",
    name: "Programa de Controle da Esquistossomose",
    system: "PCE",
    category: ALLOWED_DATASUS_CATEGORY,
    municipalityFilterStatus: "unknown",
    sourceUrl: null,
    active: true
  },
  {
    slug: "sisvan_estado_nutricional",
    name: "Estado Nutricional",
    system: "SISVAN",
    category: ALLOWED_DATASUS_CATEGORY,
    municipalityFilterStatus: "unknown",
    sourceUrl: null,
    active: true
  },
  {
    slug: "hiperdia",
    name: "Hipertensão e Diabetes",
    system: "HIPERDIA",
    category: ALLOWED_DATASUS_CATEGORY,
    municipalityFilterStatus: "unknown",
    sourceUrl: null,
    active: true
  },
  {
    slug: "siscolo_sismama",
    name: "Câncer de colo de útero e mama",
    system: "SISCOLO/SISMAMA",
    category: ALLOWED_DATASUS_CATEGORY,
    municipalityFilterStatus: "unknown",
    sourceUrl: null,
    active: true
  },
  {
    slug: "siscan",
    name: "Sistema de Informação do Câncer",
    system: "SISCAN",
    category: ALLOWED_DATASUS_CATEGORY,
    municipalityFilterStatus: "unknown",
    sourceUrl: null,
    active: true
  },
  {
    slug: "painel_oncologia",
    name: "Tempo até o início do tratamento oncológico",
    system: "Painel Oncologia",
    category: ALLOWED_DATASUS_CATEGORY,
    municipalityFilterStatus: "unknown",
    sourceUrl: null,
    active: true
  }
] as const;

export type SourceSlug = (typeof allowedSources)[number]["slug"];

export function getSourceBySlug(slug: string): AllowedSource | undefined {
  return allowedSources.find((source) => source.slug === slug);
}

export function sourceExists(slug: string): slug is SourceSlug {
  return Boolean(getSourceBySlug(slug));
}
