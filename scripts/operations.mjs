import { existsSync, copyFileSync, readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = process.env.ENV_FILE ?? ".env";
const envPath = path.resolve(rootDir, envFile);
const command = process.argv[2];
const args = process.argv.slice(3);

function fail(message) {
  console.error(message);
  process.exitCode = 1;
  return false;
}

function loadEnv() {
  if (!existsSync(envPath)) return {};
  const values = {};
  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

let env = loadEnv();
const setting = (name, fallback) => env[name] || process.env[name] || fallback;
const composeBase = ["compose", "--env-file", envFile];

function runDocker(args, options = {}) {
  return spawnSync("docker", args, {
    cwd: rootDir,
    stdio: options.capture ? "pipe" : "inherit",
    encoding: "utf8"
  });
}

function compose(args, options) {
  return runDocker([...composeBase, ...args], options);
}

function dockerAvailable() {
  const version = runDocker(["compose", "version"], { capture: true });
  if (version.status !== 0) return fail("Docker Compose nao esta funcionando. Instale/inicie o Docker Desktop e tente novamente.");
  const info = runDocker(["info"], { capture: true });
  if (info.status !== 0) return fail("O Docker nao esta acessivel. Abra o Docker Desktop e aguarde o mecanismo iniciar.");
  return true;
}

function ensureEnv({ create = false } = {}) {
  if (!existsSync(envPath)) {
    if (!create) return fail(`Arquivo ${envFile} nao encontrado. Crie-o a partir de .env.example.`);
    copyFileSync(path.join(rootDir, ".env.example"), envPath);
    console.log(`Arquivo ${envFile} criado a partir de .env.example.`);
    console.log("Atualize as senhas administrativas antes de iniciar o sistema.");
  }
  if (envFile !== ".env") copyFileSync(envPath, path.join(rootDir, ".env"));
  env = loadEnv();
  return true;
}

function requireSettings(names) {
  for (const name of names) {
    if (!setting(name, "")) return fail(`Variavel obrigatoria ausente em ${envFile}: ${name}`);
  }
  return true;
}

function hasPlaceholders() {
  const content = readFileSync(envPath, "utf8");
  return /troque-esta-senha|troque-este-segredo-de-sessao|SEU_IP|SEU_IP_OU_DOMINIO/.test(content);
}

function serviceId(service) {
  const result = compose(["ps", "-q", service], { capture: true });
  return result.status === 0 ? result.stdout.trim() : "";
}

function serviceRunning(service) {
  const id = serviceId(service);
  if (!id) return false;
  const result = runDocker(["inspect", "-f", "{{.State.Running}}", id], { capture: true });
  return result.status === 0 && result.stdout.trim() === "true";
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPostgres() {
  const attempts = Number(setting("POSTGRES_WAIT_ATTEMPTS", "60"));
  const delay = Number(setting("POSTGRES_WAIT_DELAY_SECONDS", "2"));
  const user = setting("POSTGRES_USER", "postgres");
  const database = setting("POSTGRES_DB", "pet_saude");
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (compose(["exec", "-T", "postgres", "psql", "-U", user, "-d", database, "-c", "select 1;"], { capture: true }).status === 0) return true;
    if (attempt < attempts) await wait(delay * 1000);
  }
  return fail("O PostgreSQL nao aceitou o usuario/banco configurados. Verifique o .env ou recrie o ambiente com npm run db:reset -- --force.");
}

function validateStartSettings() {
  if (!requireSettings(["FRONTEND_URL", "BACKEND_URL", "NEXT_PUBLIC_API_URL", "CORS_ORIGIN", "ADMIN_USERNAME", "ADMIN_PASSWORD", "ADMIN_SESSION_SECRET"])) return false;
  if (hasPlaceholders()) return fail("Atualize ADMIN_PASSWORD, ADMIN_SESSION_SECRET e quaisquer placeholders no .env antes de iniciar.");
  const frontendUrl = setting("FRONTEND_URL", "");
  const backendUrl = setting("BACKEND_URL", "");
  const apiUrl = setting("NEXT_PUBLIC_API_URL", "");
  const local = /localhost|127\.0\.0\.1/.test(frontendUrl) && /localhost|127\.0\.0\.1/.test(backendUrl);
  if (!local && /localhost|127\.0\.0\.1/.test(apiUrl)) return fail("NEXT_PUBLIC_API_URL nao pode apontar para localhost em um servidor remoto.");
  if (!local && setting("APP_BIND_HOST", "0.0.0.0") === "127.0.0.1") return fail("APP_BIND_HOST deve ser 0.0.0.0 quando o sistema for acessado remotamente.");
  return true;
}

async function start() {
  if (!dockerAvailable() || !ensureEnv({ create: true }) || !validateStartSettings()) return;
  console.log("Subindo PostgreSQL e Redis...");
  if (compose(["up", "-d", "postgres", "redis"]).status !== 0) return;
  console.log("Validando PostgreSQL...");
  if (!(await waitForPostgres())) return;
  console.log("Construindo backend e frontend...");
  if (compose(["build", "backend", "frontend"]).status !== 0) return;
  console.log("Aplicando migrations e seed...");
  if (compose(["run", "--rm", "backend", "npm", "--workspace", "backend", "run", "prisma:deploy"]).status !== 0) return;
  if (compose(["run", "--rm", "backend", "npm", "--workspace", "backend", "run", "seed:prod"]).status !== 0) return;
  if (compose(["up", "-d", "--no-build", "backend", "frontend"]).status !== 0) return;
  if (setting("RUN_INITIAL_SYNC", "false") === "true" && compose(["exec", "-T", "backend", "npm", "--workspace", "backend", "run", "sync:data:prod"]).status !== 0) return;
  console.log(`\nSistema iniciado.\nFrontend: ${setting("FRONTEND_URL", "http://localhost:3000")}\nBackend: ${setting("BACKEND_URL", "http://localhost:3333")}`);
}

function doctor() {
  let warnings = 0;
  const warn = (message) => { warnings += 1; console.warn(`[alerta] ${message}`); };
  if (!dockerAvailable() || !ensureEnv()) return;
  for (const name of ["FRONTEND_URL", "BACKEND_URL", "NEXT_PUBLIC_API_URL", "CORS_ORIGIN", "ADMIN_USERNAME", "ADMIN_PASSWORD", "ADMIN_SESSION_SECRET"]) {
    if (!setting(name, "")) warn(`Variavel ausente: ${name}`);
  }
  if (hasPlaceholders()) warn("Existem senhas ou URLs-placeholder no .env.");
  for (const service of ["postgres", "redis", "backend", "frontend"]) console.log(`[info] ${service}: ${serviceRunning(service) ? "em execucao" : "parado"}`);
  if (serviceRunning("postgres")) {
    const ok = compose(["exec", "-T", "postgres", "psql", "-U", setting("POSTGRES_USER", "postgres"), "-d", setting("POSTGRES_DB", "pet_saude"), "-c", "select 1;"], { capture: true }).status === 0;
    if (!ok) warn("PostgreSQL esta em execucao, mas nao aceita o usuario/banco do .env.");
  }
  if (serviceRunning("redis") && compose(["exec", "-T", "redis", "redis-cli", "ping"], { capture: true }).stdout.trim() !== "PONG") warn("Redis nao respondeu ao ping.");
  if (warnings) process.exitCode = 1;
  else console.log("Diagnostico concluido sem alertas.");
}

function stop() {
  if (!dockerAvailable() || !ensureEnv()) return;
  compose(["down", "--remove-orphans"]);
}

function resetDb() {
  if (!args.includes("--force")) return fail("Uso: npm run db:reset -- --force\nEsse comando remove os volumes Docker do banco e Redis deste projeto.");
  if (!dockerAvailable() || !ensureEnv()) return;
  if (compose(["down", "-v", "--remove-orphans"]).status === 0) console.log("Volumes removidos. Execute npm run start para recriar o ambiente.");
}

function syncData() {
  if (!dockerAvailable() || !ensureEnv()) return;
  if (!serviceRunning("backend")) return fail("Backend nao esta rodando. Execute npm run start primeiro.");
  compose(["exec", "-T", "backend", "npm", "--workspace", "backend", "run", "sync:data:prod"]);
}

function logs() {
  if (!dockerAvailable() || !ensureEnv()) return;
  spawn("docker", [...composeBase, "logs", "-f", ...args], { cwd: rootDir, stdio: "inherit", shell: process.platform === "win32" });
}

function recover() {
  const reset = args.includes("--reset-db");
  if (args.some((arg) => arg !== "--reset-db")) return fail("Uso: npm run docker:recover [-- --reset-db]");
  console.log("Reinicie o Docker Desktop pelo menu Troubleshoot > Restart e aguarde ele ficar em execucao.");
  console.log(reset ? "Depois execute: npm run db:reset -- --force" : "Depois execute: npm run stop");
}

switch (command) {
  case "start": await start(); break;
  case "doctor": doctor(); break;
  case "stop": stop(); break;
  case "restart": stop(); if (!process.exitCode) await start(); break;
  case "db-reset": resetDb(); break;
  case "sync-data": syncData(); break;
  case "logs": logs(); break;
  case "recover": recover(); break;
  default: fail("Comando operacional invalido.");
}
