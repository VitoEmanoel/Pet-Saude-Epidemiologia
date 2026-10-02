// Testes de segurança (caixa-preta) contra o sistema rodando.
// Atenção: 5 logins errados bloqueiam o admin por 15 min. Este arquivo faz no máximo
// 4 tentativas erradas e termina com um login correto, que zera o contador.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { after, before, describe, test } from "node:test";
import {
  ADMIN_PASSWORD,
  ADMIN_SESSION_SECRET,
  ADMIN_USERNAME,
  API,
  ORIGIN,
  ROOT,
  RUN_LOCKOUT,
  WEB,
  adminApi,
  adminLogin,
  api,
  assertSystemUp,
  request
} from "../support/env.mjs";

const b64 = (payload) => Buffer.from(JSON.stringify(payload)).toString("base64url");
const forge = (payload, secret) => {
  const encoded = b64(payload);
  return `${encoded}.${createHmac("sha256", secret).update(encoded).digest("base64url")}`;
};
const me = (cookieValue) => api("/api/admin/auth/me", { headers: { cookie: `painel_admin_session=${cookieValue}` } });
const loginWith = (body, headers = {}) =>
  api("/api/admin/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body)
  });

let session;
let admin;

before(async () => {
  await assertSystemUp();
  session = await adminLogin();
  assert.equal(session.status, 200);
  admin = adminApi(session.cookie);
});

after(async () => {
  // Zera o contador de tentativas erradas deste arquivo
  await adminLogin();
});

describe("Sessão administrativa", () => {
  test("Cookie assinado com segredo errado é rejeitado", async () => {
    assert.equal((await me(forge({ sub: "admin", exp: Date.now() + 1e6 }, "segredo-chutado"))).status, 401);
  });

  test("Cookie sem assinatura é rejeitado", async () => {
    assert.equal((await me(b64({ sub: "admin", exp: Date.now() + 1e6 }) + ".")).status, 401);
  });

  test("Cookie expirado (assinatura válida) é rejeitado", { skip: !ADMIN_SESSION_SECRET && "sem ADMIN_SESSION_SECRET" }, async () => {
    assert.equal((await me(forge({ sub: "admin", exp: Date.now() - 1000 }, ADMIN_SESSION_SECRET))).status, 401);
  });

  test("Cookie com sub diferente de admin é rejeitado", { skip: !ADMIN_SESSION_SECRET && "sem ADMIN_SESSION_SECRET" }, async () => {
    assert.equal((await me(forge({ sub: "root", exp: Date.now() + 1e6 }, ADMIN_SESSION_SECRET))).status, 401);
  });

  test("Payload adulterado com assinatura antiga é rejeitado", { skip: !ADMIN_SESSION_SECRET && "sem ADMIN_SESSION_SECRET" }, async () => {
    const signature = forge({ sub: "admin", exp: Date.now() + 1000 }, ADMIN_SESSION_SECRET).split(".")[1];
    assert.equal((await me(`${b64({ sub: "admin", exp: Date.now() + 1e9 })}.${signature}`)).status, 401);
  });

  test("Bearer token desativado por padrão", async () => {
    assert.equal((await api("/api/admin/auth/me", { headers: { authorization: "Bearer qualquer" } })).status, 401);
  });

  test("Cookie é HttpOnly, SameSite=Strict e restrito a /api/admin", () => {
    assert.match(session.setCookie, /HttpOnly/i);
    assert.match(session.setCookie, /SameSite=Strict/i);
    assert.match(session.setCookie, /Path=\/api\/admin/i);
  });
});

describe("Login", () => {
  test("Senha vazia é rejeitada", async () => {
    assert.equal((await loginWith({ username: ADMIN_USERNAME, password: "" })).status, 401);
  });

  test("Tipos inesperados (objeto/array) não autenticam", async () => {
    assert.equal((await loginWith({ username: { $ne: null }, password: [ADMIN_PASSWORD] })).status, 401);
  });

  test("Erro não revela se o usuário existe", async () => {
    const unknownUser = await loginWith({ username: "naoexiste", password: "x" });
    const wrongPassword = await loginWith({ username: ADMIN_USERNAME, password: "x" });
    assert.equal(unknownUser.text, wrongPassword.text);
  });

  test("Bloqueio após 5 tentativas erradas (tranca o admin por 15 min!)", { skip: !RUN_LOCKOUT && "defina QA_LOCKOUT=1" }, async () => {
    const statuses = [];
    for (let i = 0; i < 6; i += 1) {
      statuses.push((await loginWith({ username: ADMIN_USERNAME, password: "x" })).status);
    }
    assert.equal(statuses.at(-1), 429);
  });
});

describe("CSRF, origem e CORS", () => {
  test("POST administrativo de origem estranha: 403", async () => {
    const r = await api("/api/admin/sync/dengue_sinan", {
      method: "POST",
      headers: { cookie: session.cookie, origin: "https://site-malicioso.com" }
    });
    assert.equal(r.status, 403);
  });

  test("API não libera CORS para origem estranha", async () => {
    const r = await api("/api/sources", { headers: { origin: "https://site-malicioso.com" } });
    assert.notEqual(r.headers.get("access-control-allow-origin"), "https://site-malicioso.com");
  });

  test("S7: POST administrativo sem cabeçalho Origin é recusado", { todo: "S7 — Fase 5" }, async () => {
    const throwaway = await adminLogin();
    const r = await api("/api/admin/auth/logout", { method: "POST", headers: { cookie: throwaway.cookie } });
    assert.notEqual(r.status, 200, `status ${r.status}`);
  });
});

describe("Injeção e XSS", () => {
  test("Payloads de SQL/NoSQL/template nos filtros não retornam dados nem erro 500", async () => {
    const payloads = ["' OR '1'='1", "1; DROP TABLE data_sources;--", "Masculino' --", "\" OR 1=1 --", "${7*7}", "{{7*7}}", "../../etc/passwd"];
    for (const payload of payloads) {
      for (const param of ["sex", "ageGroup", "raceColor", "condition"]) {
        const r = await api(`/api/records?source=tuberculose_sinan&${param}=${encodeURIComponent(payload)}`);
        assert.ok(r.status < 500, `${param}=${payload} → ${r.status}`);
        assert.equal(r.json?.records?.length ?? 0, 0, `${param}=${payload} retornou dados`);
      }
    }
    assert.equal((await api("/api/sources/tuberculose_sinan/summary")).status, 200, "banco intacto");
  });

  for (const slug of ["..%2f..%2fetc%2fpasswd", "tuberculose_sinan%27--", "%3Cscript%3E"]) {
    test(`Slug malicioso ${decodeURIComponent(slug)}: 404`, async () => {
      assert.equal((await api(`/api/sources/${slug}/summary`)).status, 404);
    });
  }

  test("Exportação HTML escapa filtros refletidos", async () => {
    const xss = "<script>alert(1)</script>";
    const r = await admin(`/api/admin/dashboard/export.html?source=tuberculose_sinan&sex=${encodeURIComponent(xss)}`);
    assert.equal(r.status, 200);
    assert.ok(!r.text.includes(xss));
    assert.ok(r.text.includes("&lt;script&gt;"));
  });

  test("CSV sem células que virariam fórmula (= + @)", async () => {
    const r = await admin("/api/admin/records/export.csv?source=tuberculose_sinan");
    assert.ok(!/(^|,)[=+@]/m.test(r.text));
  });
});

describe("Robustez", () => {
  test("Body acima de 100 KB: 413", async () => {
    assert.equal((await loginWith({ username: "a".repeat(2_000_000), password: "x" })).status, 413);
  });

  test("Query string gigante não gera erro 500", async () => {
    assert.ok((await api(`/api/records?sex=${"A".repeat(20000)}`)).status < 500);
  });
});

describe("Exposição de informação", () => {
  for (const path of ["/.env", "/api/.env", "/package.json", "/.git/config", "/backend/.env"]) {
    test(`Arquivo sensível ${path} não é servido`, async () => {
      assert.equal((await request(WEB + path)).status, 404);
      assert.equal((await request(API + path)).status, 404);
    });
  }

  test("Erro de parse não expõe stack trace", async () => {
    const r = await loginWith("{x");
    assert.ok(!/at .*\(\/app\//.test(r.text));
  });

  test("S8: backend não anuncia X-Powered-By", async () => {
    assert.equal((await api("/health")).headers.get("x-powered-by"), null);
  });

  test("S8: frontend não anuncia X-Powered-By", async () => {
    assert.equal((await request(WEB + "/")).headers.get("x-powered-by"), null);
  });

  test("S4: auditoria não confia em X-Forwarded-For forjado", { todo: "S4 — Fase 2" }, async () => {
    await loginWith({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }, { "x-forwarded-for": "8.8.8.8" });
    const logs = (await admin("/api/admin/audit-logs")).json.auditLogs;
    assert.notEqual(logs[0].ipAddress, "8.8.8.8");
  });
});

describe("Cabeçalhos de segurança", () => {
  test("Admin: no-store, X-Frame-Options DENY e CSP", async () => {
    const headers = (await admin("/api/admin/auth/me")).headers;
    assert.match(headers.get("cache-control") ?? "", /no-store/);
    assert.equal(headers.get("x-frame-options"), "DENY");
    assert.ok(headers.get("content-security-policy"));
  });

  test("S2: site público envia CSP, X-Frame-Options, nosniff e Referrer-Policy", async () => {
    const headers = (await request(WEB + "/")).headers;
    for (const name of ["content-security-policy", "x-frame-options", "x-content-type-options", "referrer-policy"]) {
      assert.ok(headers.get(name), `${name} ausente`);
    }
  });

  test("S2: API pública envia X-Content-Type-Options", async () => {
    assert.equal((await api("/api/sources")).headers.get("x-content-type-options"), "nosniff");
  });

  test("S2: CSP do site impede ser embutido, plugins e envio de dados para fora", async () => {
    const csp = (await request(WEB + "/")).headers.get("content-security-policy") ?? "";
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /form-action 'self'/);
    assert.doesNotMatch(csp, /connect-src[^;]*\*/, "connect-src sem curinga");
    assert.doesNotMatch(csp, /unsafe-eval/, "unsafe-eval só no modo de desenvolvimento");
  });

  test("S2: API pública envia CSP restritiva, X-Frame-Options e HSTS", async () => {
    const headers = (await api("/api/sources")).headers;
    assert.match(headers.get("content-security-policy") ?? "", /default-src 'none'/);
    assert.ok(headers.get("x-frame-options"));
    assert.match(headers.get("strict-transport-security") ?? "", /max-age=\d+/);
  });

  test("S2: CORS continua liberando o frontend", async () => {
    const r = await request(API + "/api/sources", { headers: { origin: ORIGIN } });
    assert.equal(r.headers.get("access-control-allow-origin"), ORIGIN);
  });
});

describe("Containers", () => {
  // Só roda quando o sistema está no Docker desta máquina (pula em servidor remoto).
  const containerUid = (service) => {
    try {
      return execFileSync("docker", ["compose", "--env-file", ".env", "exec", "-T", service, "id", "-u"], {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"]
      }).trim();
    } catch {
      return null;
    }
  };

  for (const service of ["backend", "frontend"]) {
    test(`S3: ${service} não roda como root`, (t) => {
      const uid = containerUid(service);
      if (uid === null) {
        return t.skip("container não acessível pelo docker compose");
      }
      assert.notEqual(uid, "0");
    });
  }
});

