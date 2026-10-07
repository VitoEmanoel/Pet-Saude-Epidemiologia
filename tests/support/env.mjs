// Configuração compartilhada dos testes de QA.
// Lê o .env da raiz do projeto (sem copiá-lo) e expõe URLs e credenciais.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const OUTPUT = fileURLToPath(new URL("../output/", import.meta.url));

function readEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => line.includes("=") && !line.trimStart().startsWith("#"))
      .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()])
  );
}

const fileEnv = readEnvFile(process.env.ENV_FILE ?? `${ROOT}.env`);
const pick = (name, fallback) => process.env[name] ?? fileEnv[name] ?? fallback;

export const API = pick("QA_API_URL", "http://localhost:3333");
export const WEB = pick("QA_WEB_URL", "http://localhost:3000");
export const ORIGIN = pick("CORS_ORIGIN", WEB).split(",")[0].trim();
export const ADMIN_USERNAME = pick("ADMIN_USERNAME", "admin");
export const ADMIN_PASSWORD = pick("ADMIN_PASSWORD", "");
export const ADMIN_SESSION_SECRET = pick("ADMIN_SESSION_SECRET", "");

// Testes que dependem da internet (TABNET) ou que alteram estado sensível são opcionais.
export const RUN_TABNET = process.env.QA_TABNET === "1";
export const RUN_LOCKOUT = process.env.QA_LOCKOUT === "1";

export const PUBLIC_SOURCES = [
  "tuberculose_sinan",
  "hanseniase_sinan",
  "sifilis_congenita_sinan",
  "dengue_sinan",
  "zika_sinan",
  "chikungunya_sinan",
  "sifilis_gestacional_sinan"
];
export const PRIMARY_SOURCES = PUBLIC_SOURCES;

export async function request(url, options = {}) {
  const response = await fetch(url, { redirect: "manual", ...options });
  const text = await response.text();
  let json = null;

  try {
    json = JSON.parse(text);
  } catch {}

  return { status: response.status, headers: response.headers, text, json };
}

export const api = (path, options) => request(API + path, options);
export const sum = (series) => series.reduce((total, point) => total + point.value, 0);

export async function adminLogin(password = ADMIN_PASSWORD) {
  const response = await fetch(API + "/api/admin/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN },
    body: JSON.stringify({ username: ADMIN_USERNAME, password })
  });
  const cookie = (response.headers.get("set-cookie") ?? "").split(";")[0];

  return { status: response.status, cookie, setCookie: response.headers.get("set-cookie") ?? "" };
}

export function adminApi(cookie) {
  return (path, options = {}) =>
    api(path, { ...options, headers: { cookie, origin: ORIGIN, ...(options.headers ?? {}) } });
}

export async function assertSystemUp() {
  try {
    const health = await fetch(API + "/health");

    if (health.ok) {
      return;
    }
  } catch {}

  throw new Error(`Sistema fora do ar em ${API}. Rode "npm run start" antes dos testes.`);
}
