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
    slug: "tuberculose_sinan",
    name: "Casos de Tuberculose",
    system: "SINAN",
    category: ALLOWED_DATASUS_CATEGORY,
    municipalityFilterStatus: "available",
    sourceUrl: "http://tabnet.datasus.gov.br/cgi/deftohtm.exe?sinannet/cnv/tubercbr.def",
    active: true
  },
  {
    slug: "hanseniase_sinan",
    name: "Casos de Hanseníase",
    system: "SINAN",
    category: ALLOWED_DATASUS_CATEGORY,
    municipalityFilterStatus: "available",
    sourceUrl: "http://tabnet.datasus.gov.br/cgi/deftohtm.exe?sinannet/cnv/hanswbr.def",
    active: true
  },
  {
    slug: "sifilis_congenita_sinan",
    name: "Casos de Sífilis Congênita",
    system: "SINAN",
    category: ALLOWED_DATASUS_CATEGORY,
    municipalityFilterStatus: "available",
    sourceUrl: "http://tabnet.datasus.gov.br/cgi/deftohtm.exe?sinannet/cnv/sifilisbr.def",
    active: true
  },
  {
    slug: "dengue_sinan",
    name: "Casos de Dengue",
    system: "SINAN",
    category: ALLOWED_DATASUS_CATEGORY,
    municipalityFilterStatus: "unknown",
    sourceUrl: null,
    active: false
  },
  {
    slug: "arboviroses_sinan",
    name: "Arboviroses em geral",
    system: "SINAN",
    category: ALLOWED_DATASUS_CATEGORY,
    municipalityFilterStatus: "unknown",
    sourceUrl: null,
    active: false
  },
  {
    slug: "sifilis_gestacional_sinan",
    name: "Casos de Sífilis Gestacional",
    system: "SINAN",
    category: ALLOWED_DATASUS_CATEGORY,
    municipalityFilterStatus: "unknown",
    sourceUrl: null,
    active: false
  }
] as const;

export const activeSources = allowedSources.filter((source) => source.active);

export type SourceSlug = (typeof allowedSources)[number]["slug"];

export function getSourceBySlug(slug: string): AllowedSource | undefined {
  return allowedSources.find((source) => source.slug === slug);
}

export function sourceExists(slug: string): slug is SourceSlug {
  return Boolean(getSourceBySlug(slug));
}
