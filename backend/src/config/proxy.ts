/**
 * Valor de `trust proxy` do Express a partir de TRUST_PROXY.
 *
 * Define de quem o backend aceita o cabeçalho X-Forwarded-For para descobrir o IP real
 * do visitante (usado na auditoria e no bloqueio de login):
 * - vazio ou "false": ninguém (backend exposto direto; o cabeçalho é ignorado);
 * - número (ex.: "1"): quantos proxies confiáveis existem na frente do backend;
 * - lista de IPs/redes (ex.: "loopback, 172.16.0.0/12"): só esses proxies.
 *
 * "true" (confiar em qualquer um) é recusado: deixaria qualquer visitante forjar o IP.
 */
export function parseTrustProxy(value: string | undefined): false | number | string {
  const normalized = value?.trim() ?? "";

  if (normalized === "" || normalized === "false" || normalized === "0") {
    return false;
  }

  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }

  if (normalized === "true") {
    console.warn("TRUST_PROXY=true ignorado: permitiria forjar o IP. Use o número de proxies ou os IPs deles.");
    return false;
  }

  return normalized;
}
