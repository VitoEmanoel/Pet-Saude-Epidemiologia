// S10: roda os testes do backend num banco SEPARADO (pet_saude_test), nunca no banco do sistema.
// O banco de teste é derivado do DATABASE_URL do backend/.env (mesmo servidor, nome + "_test"),
// ou vem de TEST_DATABASE_URL. Antes dos testes ele é criado/atualizado (migrations + fontes).
// Trava: só aceita servidor local e banco com nome terminado em "_test".
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function readDatabaseUrl(file) {
  if (!existsSync(file)) {
    return undefined;
  }
  const line = readFileSync(file, "utf8").split("\n").find((l) => l.trim().startsWith("DATABASE_URL="));
  return line?.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
}

function testDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) {
    return new URL(process.env.TEST_DATABASE_URL);
  }
  // O backend/.env (fora do Docker) aponta para o banco local; o DATABASE_URL do terminal é
  // ignorado de propósito (pode ser o da raiz, com o endereço interno do Docker).
  const base = readDatabaseUrl(path.join(BACKEND_DIR, ".env"));
  if (!base) {
    fail("Defina TEST_DATABASE_URL ou o DATABASE_URL no backend/.env (banco local).");
  }
  const url = new URL(base);
  url.pathname = `/${url.pathname.replace(/^\//, "")}_test`;
  return url;
}

function fail(message) {
  console.error(`ERRO (testes do backend): ${message}`);
  process.exit(1);
}

function run(command, args, env) {
  const result = spawnSync(command, args, { cwd: BACKEND_DIR, env, stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const url = testDatabaseUrl();
const database = url.pathname.replace(/^\//, "");

if (!LOCAL_HOSTS.has(url.hostname)) {
  fail(`o banco de teste precisa ser local (está em "${url.hostname}"). Os testes nunca rodam em servidor.`);
}
if (!database.endsWith("_test")) {
  fail(`o nome do banco de teste precisa terminar em "_test" (está "${database}").`);
}

const env = { ...process.env, DATABASE_URL: url.toString(), TEST_DATABASE_URL: url.toString(), NODE_ENV: "test" };
console.log(`Banco de teste: ${url.hostname}:${url.port || 5432}/${database}`);

// Cria o banco se não existir e aplica as migrations; depois cadastra as fontes.
run("npx", ["prisma", "migrate", "deploy"], env);
run("npx", ["tsx", "prisma/seed.ts"], env);

const files = process.argv.slice(2);
// Um arquivo por vez: alguns testes preparam dados próprios no banco de teste.
run(process.execPath, ["--import", "tsx", "--test", "--test-concurrency=1", ...files], env);
