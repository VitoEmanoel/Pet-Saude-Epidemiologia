/**
 * Prefixo do site quando ele não mora na raiz do domínio (ex.: "/painel" na VPS da UESPI,
 * que divide o endereço com outro sistema). Vazio = raiz. Lido no build, como a URL da API.
 * Links do Next (<Link>, router) já usam o prefixo sozinhos; <img> e URLs montadas à mão, não.
 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

export function withBasePath(path: string) {
  return `${BASE_PATH}${path}`;
}
