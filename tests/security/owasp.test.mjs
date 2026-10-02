// Testes de segurança organizados pelas categorias do OWASP Top 10.
// Cada teste indica a abordagem:
//   [preta]  caixa preta: só a URL, sem conhecer o código nem ter senha (visão de um atacante);
//   [cinza]  caixa cinza: com a senha do admin e conhecendo o formato da sessão e das rotas;
//   [branca] caixa branca: lendo o código-fonte e a configuração do projeto.
// Problemas ainda abertos ficam como `todo` (ver docs/11 e docs/14).
// No máximo 4 logins errados por execução, seguidos de um login certo (5 trancariam o admin).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import {
  ADMIN_PASSWORD,
  ORIGIN,
  ROOT,
  adminApi,
  adminLogin,
  api,
  assertSystemUp,
  request,
  WEB
} from "../support/env.mjs";

const json = { "content-type": "application/json", origin: ORIGIN };
const login = (body, headers = json) =>
  api("/api/admin/auth/login", { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) });

const read = (path) => readFileSync(join(ROOT, path), "utf8");
function sourceFiles(dir) {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name);
    return statSync(join(ROOT, path)).isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}
const backendCode = sourceFiles("backend/src").filter((path) => !path.endsWith(".test.ts"));
const frontendCode = sourceFiles("frontend/src");

const ADMIN_GET_ROUTES = [
  "/api/admin/auth/me",
  "/api/admin/audit-logs",
  "/api/admin/sync-history",
  "/api/admin/records/export.csv?source=tuberculose_sinan",
  "/api/admin/dashboard/export.html?source=tuberculose_sinan"
];
const ADMIN_POST_ROUTES = ["/api/admin/auth/logout", "/api/admin/sync-all", "/api/admin/sync/tuberculose_sinan"];

before(assertSystemUp);

// Termina com um login certo: zera o contador de tentativas erradas desta execução.
after(async () => {
  if (ADMIN_PASSWORD) {
    await adminLogin();
  }
});

describe("A03 Injeção", () => {
  const SQL = ["' OR '1'='1", "1; DROP TABLE records--", "' UNION SELECT password FROM pg_user--", "1' AND pg_sleep(3)--"];

  test("[preta] SQL injection por tempo (pg_sleep) não atrasa a resposta", async () => {
    for (const payload of SQL) {
      for (const param of ["sex", "year", "ageGroup", "raceColor", "condition"]) {
        const started = Date.now();
        const r = await api(`/api/records?source=tuberculose_sinan&${param}=${encodeURIComponent(payload)}`);
        assert.ok(r.status < 500, `${param}=${payload}: ${r.status}`);
        assert.ok(Date.now() - started < 2500, `${param}=${payload} demorou: possível injeção por tempo`);
      }
    }
  });

  test("[preta] SQL injection no caminho (slug) não vaza dados", async () => {
    for (const slug of ["tuberculose_sinan' OR '1'='1", "x' UNION SELECT 1--"]) {
      assert.equal((await api(`/api/sources/${encodeURIComponent(slug)}/summary`)).status, 404);
    }
  });

  test("[preta] Operadores NoSQL e objetos na query string não viram filtro", async () => {
    for (const query of ["source[$ne]=x", "source[$gt]=", "source=tuberculose_sinan&sex[$ne]=x", "source=tuberculose_sinan&year[$gt]=0"]) {
      const r = await api(`/api/records?${query}`);
      assert.ok([200, 400, 404].includes(r.status), `${query}: ${r.status}`);
      if (r.status === 200) {
        assert.equal(r.json.filters.sex, undefined, `${query}: objeto virou filtro`);
      }
    }
  });

  test("[preta] Login com objetos NoSQL ({$ne: null}) não autentica", async () => {
    const r = await login({ username: { $ne: null }, password: { $ne: null } });
    assert.equal(r.status, 401);
  });

  test("[preta] Poluição de protótipo no corpo do login não autentica", async () => {
    const r = await login('{"username":"x","password":"y","__proto__":{"isAdmin":true},"constructor":{"prototype":{"isAdmin":true}}}');
    assert.equal(r.status, 401);
    assert.equal((await api("/api/admin/auth/me")).status, 401, "protótipo poluído liberou o admin");
  });

  test("[preta] Injeção de comando e template não é executada", async () => {
    for (const payload of ["$(id)", "`id`", "; cat /etc/passwd", "{{7*7}}", "${7*7}", "<%= 7*7 %>"]) {
      const r = await api(`/api/records?source=tuberculose_sinan&condition=${encodeURIComponent(payload)}`);
      assert.ok(r.status < 500);
      assert.doesNotMatch(r.text, /uid=\d+|root:x:0|(^|[^0-9])49([^0-9]|$)/, `${payload} executou`);
    }
  });

  test("[preta] CRLF em parâmetro não injeta cabeçalho", async () => {
    const r = await api("/api/records?source=tuberculose_sinan&sex=x%0d%0aSet-Cookie:%20injetado=1");
    assert.equal(r.headers.get("set-cookie"), null);
  });

  test("[cinza] XSS refletido: exportação HTML escapa o payload em todos os filtros", async () => {
    const { cookie } = await adminLogin();
    const admin = adminApi(cookie);
    const payload = `"><script>alert(1)</script><img src=x onerror=alert(2)>`;
    for (const param of ["sex", "ageGroup", "raceColor", "condition", "year"]) {
      const r = await admin(`/api/admin/dashboard/export.html?source=tuberculose_sinan&${param}=${encodeURIComponent(payload)}`);
      if (param === "year") {
        assert.equal(r.status, 400, "ano com texto deve ser recusado antes de chegar ao HTML (S14)");
        continue;
      }
      assert.equal(r.status, 200);
      assert.doesNotMatch(r.text, /<script>alert|<img src=x/i, `${param} refletido sem escape`);
      assert.match(r.headers.get("content-disposition") ?? "", /^attachment/);
    }
  });

  test("[cinza] Respostas de erro são JSON com nosniff (nada refletido vira HTML)", async () => {
    const r = await api("/api/records?<script>alert(1)</script>=1");
    assert.equal(r.status, 400);
    assert.match(r.headers.get("content-type") ?? "", /application\/json/);
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  });

  test("[branca] Nenhuma consulta SQL montada com texto (só Prisma parametrizado)", () => {
    for (const path of backendCode) {
      assert.doesNotMatch(read(path), /\$queryRawUnsafe|\$executeRawUnsafe|Prisma\.raw\(/, path);
    }
  });

  test("[branca] Sem eval, new Function ou execução de comandos no backend", () => {
    for (const path of backendCode) {
      assert.doesNotMatch(read(path), /\beval\(|new Function\(|child_process/, path);
    }
  });

  test("[branca] HTML cru no frontend só no script fixo do tema", () => {
    const uses = frontendCode.filter((path) => read(path).includes("dangerouslySetInnerHTML"));
    assert.deepEqual(uses, ["frontend/src/app/layout.tsx"]);
  });
});

describe("A01 Controle de acesso", () => {
  test("[preta] Todas as rotas GET do admin exigem sessão", async () => {
    for (const path of ADMIN_GET_ROUTES) {
      assert.equal((await api(path)).status, 401, path);
    }
  });

  test("[preta] Todas as rotas POST do admin exigem sessão", async () => {
    for (const path of ADMIN_POST_ROUTES) {
      assert.equal((await api(path, { method: "POST", headers: { origin: ORIGIN } })).status, 401, path);
    }
  });

  test("[preta] Variações de caminho não contornam a autenticação", async () => {
    for (const path of [
      "/API/ADMIN/audit-logs",
      "/api/admin/audit-logs/",
      "//api/admin/audit-logs",
      "/api/./admin/audit-logs",
      "/api/admin/%61udit-logs",
      "/api/admin;/audit-logs",
      "/api/admin/audit-logs%00",
      "/api/admin/audit-logs?x=../../",
      "/api/sources/../admin/audit-logs"
    ]) {
      assert.ok([401, 404].includes((await api(path)).status), path);
    }
  });

  test("[preta] Métodos não previstos são recusados", async () => {
    for (const method of ["PUT", "DELETE", "PATCH"]) {
      assert.equal((await api("/api/records?source=tuberculose_sinan", { method })).status, 404, method);
      assert.equal((await api("/api/admin/audit-logs", { method })).status, 401, method);
    }
  });

  test("[preta] Cookie forjado, vazio ou de outro formato não abre o admin", async () => {
    for (const cookie of ["painel_admin_session=", "painel_admin_session=abc.def", "painel_admin_session=e30.e30", "painel_admin_session=admin"]) {
      assert.equal((await api("/api/admin/auth/me", { headers: { cookie } })).status, 401, cookie);
    }
  });

  test("[preta] Filtro de outro município é recusado com qualquer grafia", async () => {
    for (const query of ["City=2211001", "CIDADE=x", "municipio=x", "ibge_code=2211001", "uf=CE", "Municipality=x"]) {
      assert.equal((await api(`/api/records?source=tuberculose_sinan&${query}`)).status, 400, query);
    }
  });

  test("[preta] Exportações públicas não existem (só no admin)", async () => {
    for (const path of ["/api/records/export.csv", "/api/export.csv", "/api/dashboard/export.html"]) {
      assert.equal((await api(path + "?source=tuberculose_sinan")).status, 404, path);
    }
  });

  test("S12 [preta] Listagem sem fonte não traz registros da fonte interna", async () => {
    const r = await api("/api/records?aggregation=all&pageSize=500&page=1");
    assert.equal(r.status, 200);
    for (let page = 1; page <= r.json.pagination.totalPages; page += 1) {
      const records = page === 1 ? r.json.records : (await api(`/api/records?aggregation=all&pageSize=500&page=${page}`)).json.records;
      assert.ok(!records.some((record) => record.source.slug === "zika_sinan"), `zika na página ${page}`);
    }
  });

  test("S12 [preta] Fonte interna (zika) não é exposta em nenhuma rota pública", async () => {
    for (const path of [
      "/api/sources/zika_sinan",
      "/api/sources/zika_sinan/summary",
      "/api/charts/yearly-evolution?source=zika_sinan",
      "/api/records?source=zika_sinan"
    ]) {
      assert.equal((await api(path)).status, 404, path);
    }
  });

  test("[cinza] CORS não libera origem estranha nem com credenciais", async () => {
    const r = await api("/api/admin/auth/login", {
      method: "OPTIONS",
      headers: { origin: "https://evil.example", "access-control-request-method": "POST" }
    });
    assert.equal(r.headers.get("access-control-allow-origin"), null);
  });

  test("[cinza] CSRF: POST do admin vindo de outro site é recusado mesmo com sessão", async () => {
    const { cookie } = await adminLogin();
    const r = await api("/api/admin/sync-all", { method: "POST", headers: { cookie, origin: "https://evil.example" } });
    assert.equal(r.status, 403);
  });

  test("[cinza] Ações do admin não aceitam GET (sem mudança de estado por link)", async () => {
    const { cookie } = await adminLogin();
    for (const path of ADMIN_POST_ROUTES) {
      assert.equal((await adminApi(cookie)(path)).status, 404, path);
    }
  });

  test("[branca] Só o login fica antes do requireAdminAuth", () => {
    const code = read("backend/src/routes/admin.ts");
    const guard = code.indexOf("adminRouter.use(requireAdminAuth)");
    assert.ok(guard > 0, "requireAdminAuth não encontrado");
    const before = [...code.slice(0, guard).matchAll(/adminRouter\.(get|post|put|patch|delete)\("([^"]+)"/g)].map((m) => m[2]);
    assert.deepEqual(before, ["/auth/login"]);
  });
});

describe("A07 Autenticação e sessão", () => {
  test("[preta] Mensagem de erro igual para usuário inexistente e senha errada", async () => {
    const wrongUser = await login({ username: "nao-existe-qa", password: "x" });
    const wrongPass = await login({ username: "admin", password: "senha-errada-qa" });
    assert.equal(wrongUser.status, 401);
    assert.equal(wrongUser.json.error.message, wrongPass.json.error.message);
  });

  test("[preta] Login só aceita JSON (formulário e text/plain não autenticam)", async () => {
    const form = await login("username=admin&password=x", { "content-type": "application/x-www-form-urlencoded", origin: ORIGIN });
    assert.equal(form.status, 401);
  });

  test("[cinza] Cookie de sessão: HttpOnly, SameSite=Strict, Path=/api/admin, validade de 8 h", async () => {
    const { setCookie } = await adminLogin();
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Strict/i);
    assert.match(setCookie, /Path=\/api\/admin/i);
    assert.match(setCookie, /Max-Age=28800/i);
  });

  test("[cinza] Cada login gera um cookie diferente", async () => {
    const first = (await adminLogin()).cookie;
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = (await adminLogin()).cookie;
    assert.notEqual(first, second);
  });

  test("[cinza] Logout apaga o cookie no navegador", async () => {
    const { cookie } = await adminLogin();
    const r = await adminApi(cookie)("/api/admin/auth/logout", { method: "POST" });
    assert.match(r.headers.get("set-cookie") ?? "", /painel_admin_session=;/);
  });

  test("S11 [cinza] Cookie copiado antes do logout deixa de valer depois dele", async () => {
    const { cookie } = await adminLogin();
    const admin = adminApi(cookie);
    await admin("/api/admin/auth/logout", { method: "POST" });
    assert.equal((await admin("/api/admin/auth/me")).status, 401, "sessão continua válida após o logout");
  });

  test("[cinza] XSS armazenado: payload no usuário e no navegador fica gravado como texto", async () => {
    const payload = "<img src=x onerror=alert(1)>";
    await login({ username: payload, password: "x" }, { ...json, "user-agent": payload });
    const { cookie } = await adminLogin();
    const logs = (await adminApi(cookie)("/api/admin/audit-logs")).json.auditLogs;
    const entry = logs.find((log) => log.userAgent === payload);
    assert.ok(entry, "tentativa não foi auditada");
    // O texto é guardado como veio; a proteção é o React escapar na tela (conferido no teste de interface).
    assert.equal(entry.metadata.username, payload);
  });

  test("S16 [branca] Comparação de credenciais não revela o tamanho por tempo de resposta", { todo: "S16" }, () => {
    const code = read("backend/src/middleware/admin-auth.ts");
    const safeEqual = code.slice(code.indexOf("function safeEqual"), code.indexOf("function safeEqual") + 400);
    assert.doesNotMatch(safeEqual, /length !== /, "safeEqual sai antes ao comparar tamanhos diferentes");
    assert.doesNotMatch(code, /authorization === expectedAuthorization/, "token Bearer comparado com ===");
  });
});

describe("A05 Configuração e A04 lógica de negócio", () => {
  test("[preta] Arquivos internos não são servidos", async () => {
    for (const path of ["/.env", "/.git/HEAD", "/package.json", "/next.config.ts", "/backend/.env", "/Dockerfile"]) {
      assert.ok([404, 405].includes((await request(WEB + path)).status), "web " + path);
      assert.equal((await api(path)).status, 404, "api " + path);
    }
  });

  test("[preta] Source maps do frontend não são publicados", async () => {
    const html = (await request(WEB + "/")).text;
    const chunk = html.match(/\/_next\/static\/chunks\/[^"]+\.js/)?.[0];
    assert.ok(chunk, "nenhum chunk encontrado");
    assert.equal((await request(WEB + chunk + ".map")).status, 404);
  });

  test("[preta] TRACE desabilitado", async () => {
    const out = execFileSync("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", "-X", "TRACE", API_URL("/api/records")], { encoding: "utf8" });
    assert.notEqual(out, "200");
  });

  test("[preta] Paginação tem limites (sem página negativa nem lote gigante)", async () => {
    const huge = await api("/api/records?source=tuberculose_sinan&pageSize=100000");
    assert.equal(huge.json.pagination.pageSize, 500);
    for (const query of ["page=-5", "pageSize=-5", "page=0", "pageSize=0", "pageSize=1000000000"]) {
      assert.equal((await api(`/api/records?source=tuberculose_sinan&${query}`)).status, 400, query);
    }
  });

  test("S14 [preta] Valores inválidos de filtro são recusados (não ignorados em silêncio)", async () => {
    for (const query of ["year=abc", "year=1e308", "page=abc", "aggregation=yearly&pageSize=abc", "month=13", "year=2020&year=2021", "sex[$ne]=x"]) {
      assert.equal((await api(`/api/records?source=tuberculose_sinan&${query}`)).status, 400, query);
    }
  });

  test("[cinza] Sincronizações simultâneas da mesma fonte: só uma roda (as outras recebem 409)", { skip: process.env.QA_TABNET !== "1" && "defina QA_TABNET=1 (usa o TABNET)" }, async () => {
    const { cookie } = await adminLogin();
    const admin = adminApi(cookie);
    const before = (await api("/api/sources/hanseniase_sinan/summary")).json.summary.totalRecords;
    const results = await Promise.all([1, 2, 3].map(() => admin("/api/admin/sync/hanseniase_sinan", { method: "POST" })));
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [200, 409, 409]);
    assert.equal((await api("/api/sources/hanseniase_sinan/summary")).json.summary.totalRecords, before, "duplicou registros");
  });

  test("S17 [branca] API pública com limite de requisições por IP", () => {
    assert.match(read("backend/src/server.ts"), /app\.use\("\/api", createApiRateLimiter\(\)\)/);
    assert.match(read("backend/src/config/rate-limit.ts"), /isPrivateAddress\(request\.ip\)/);
  });

  test("[branca] .env e segredos fora do git", () => {
    const tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n");
    assert.ok(!tracked.some((path) => /(^|\/)\.env$/.test(path)), ".env versionado");
    assert.ok(!tracked.some((path) => /\.(pem|key)$|id_rsa/.test(path)), "chave versionada");
  });

  test("[branca] Containers finais rodam sem root", () => {
    const dockerfile = read("Dockerfile");
    assert.equal((dockerfile.match(/^USER node$/gm) ?? []).length, 2);
  });

  test("[branca] Banco exposto só na máquina local por padrão", () => {
    assert.match(read("docker-compose.yml"), /\$\{SERVICE_BIND_HOST:-127\.0\.0\.1\}:\$\{POSTGRES_PORT/);
  });

  test("S13 [branca] Imagem base com Node.js ainda suportado (Node 20 acabou em 30/04/2026)", () => {
    const versions = [...read("Dockerfile").matchAll(/^FROM node:(\d+)/gm)].map((m) => Number(m[1]));
    assert.ok(versions.length > 0);
    assert.ok(versions.every((v) => v >= 22), `node:${versions.join(", node:")}`);
  });

  test("S13 [cinza] Containers em produção sem npm (menos superfície de ataque)", (t) => {
    for (const service of ["backend", "frontend"]) {
      let found;
      try {
        found = execFileSync("docker", ["compose", "--env-file", ".env", "exec", "-T", service, "sh", "-c", "command -v npm || true"], {
          cwd: ROOT,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"]
        }).trim();
      } catch {
        return t.skip("container não acessível pelo docker compose");
      }
      assert.equal(found, "", `${service} tem npm`);
    }
  });

  test("S15 [branca] start.sh recusa senha padrão do banco e segredos curtos em servidor", () => {
    const start = read("scripts/start.sh");
    assert.match(start, /POSTGRES_PASSWORD:-postgres\}" == "postgres"/);
    assert.match(start, /#ADMIN_PASSWORD\} -lt 12/);
    assert.match(start, /#ADMIN_SESSION_SECRET\} -lt 32/);
    assert.match(read("backend/src/main.ts"), /getWeakConfigWarnings\(\)/);
  });
});

function API_URL(path) {
  return new URL(path, process.env.QA_API_URL ?? "http://localhost:3333").toString();
}
