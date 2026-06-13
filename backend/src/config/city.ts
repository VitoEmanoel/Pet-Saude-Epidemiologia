export const ALLOWED_CITY = {
  name: "Parnaíba",
  state: "Piauí",
  uf: "PI",
  ibgeCode: "2207702"
} as const;

export const ALLOWED_DATASUS_CATEGORY = "epidemiologicas_morbidade" as const;

export const BLOCKED_MUNICIPALITY_QUERY_PARAMS = new Set([
  "city",
  "cidade",
  "municipality",
  "municipio",
  "ibgeCode",
  "ibge_code",
  "cityIbgeCode",
  "city_ibge_code",
  "uf",
  "state",
  "estado"
]);

