import { ALLOWED_DATASUS_CATEGORY } from "./city";

export type MunicipalityFilterStatus = "unknown" | "available" | "unavailable";
export type SourceKind = "primary" | "derived" | "internal";

export type AllowedSource = {
  slug: string;
  name: string;
  system: string;
  category: typeof ALLOWED_DATASUS_CATEGORY;
  municipalityFilterStatus: MunicipalityFilterStatus;
  sourceUrl: string | null;
  active: boolean;
  syncEnabled: boolean;
  kind: SourceKind;
  composedOf?: readonly string[];
};

export const allowedSources: readonly AllowedSource[] = [
  {
    slug: "tuberculose_sinan",
    name: "Casos de Tuberculose",
    system: "SINAN",
    category: ALLOWED_DATASUS_CATEGORY,
    municipalityFilterStatus: "available",
    sourceUrl: "http://tabnet.datasus.gov.br/cgi/deftohtm.exe?sinannet/cnv/tubercbr.def",
    active: true,
    syncEnabled: true,
    kind: "primary"
  },
  {
    slug: "hanseniase_sinan",
    name: "Casos de Hanseníase",
    system: "SINAN",
    category: ALLOWED_DATASUS_CATEGORY,
    municipalityFilterStatus: "available",
    sourceUrl: "http://tabnet.datasus.gov.br/cgi/deftohtm.exe?sinannet/cnv/hanswbr.def",
    active: true,
    syncEnabled: true,
    kind: "primary"
  },
  {
    slug: "sifilis_congenita_sinan",
    name: "Casos de Sífilis Congênita",
    system: "SINAN",
    category: ALLOWED_DATASUS_CATEGORY,
    municipalityFilterStatus: "available",
    sourceUrl: "http://tabnet.datasus.gov.br/cgi/deftohtm.exe?sinannet/cnv/sifilisbr.def",
    active: true,
    syncEnabled: true,
    kind: "primary"
  },
  {
    slug: "dengue_sinan",
    name: "Casos de Dengue",
    system: "SINAN",
    category: ALLOWED_DATASUS_CATEGORY,
    municipalityFilterStatus: "available",
    sourceUrl: "http://tabnet.datasus.gov.br/cgi/deftohtm.exe?sinannet/cnv/denguebr.def",
    active: true,
    syncEnabled: true,
    kind: "primary"
  },
  {
    slug: "sifilis_gestacional_sinan",
    name: "Casos de Sífilis Gestacional",
    system: "SINAN",
    category: ALLOWED_DATASUS_CATEGORY,
    municipalityFilterStatus: "available",
    sourceUrl: "http://tabnet.datasus.gov.br/cgi/tabcgi.exe?sinannet/cnv/sifilisgestantepi.def",
    active: true,
    syncEnabled: true,
    kind: "primary"
  },
  {
    slug: "zika_sinan",
    name: "Casos de Zika",
    system: "SINAN",
    category: ALLOWED_DATASUS_CATEGORY,
    municipalityFilterStatus: "available",
    sourceUrl: "http://tabnet.datasus.gov.br/cgi/deftohtm.exe?sinannet/cnv/zikabr.def",
    active: true,
    syncEnabled: true,
    kind: "internal"
  }
] as const;

export const publicSources = allowedSources.filter((source) => source.kind !== "internal");
export const activeSources = publicSources.filter((source) => source.active);
export const syncableSources = allowedSources.filter((source) => source.syncEnabled);

export type SourceSlug = (typeof allowedSources)[number]["slug"];

export function getSourceBySlug(slug: string): AllowedSource | undefined {
  return allowedSources.find((source) => source.slug === slug);
}

export function getPublicSourceBySlug(slug: string): AllowedSource | undefined {
  return publicSources.find((source) => source.slug === slug);
}

export function sourceExists(slug: string): slug is SourceSlug {
  return Boolean(getSourceBySlug(slug));
}
