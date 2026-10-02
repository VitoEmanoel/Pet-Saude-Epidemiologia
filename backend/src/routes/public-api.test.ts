import assert from "node:assert/strict";
import type { Server } from "node:http";
import { after, before, test } from "node:test";
import { prisma } from "../database/prisma";
import { parseTrustProxy } from "../config/proxy";
import { isPrivateAddress } from "../config/rate-limit";
import {
  getAdminCookieSecurityWarning,
  getWeakConfigWarnings,
  resetAdminSecurityState
} from "../middleware/admin-auth";
import { createServer } from "../server";

let server: Server;
let baseUrl: string;
const previousAdminUsername = process.env.ADMIN_USERNAME;
const previousAdminToken = process.env.ADMIN_TOKEN;
const previousAdminPassword = process.env.ADMIN_PASSWORD;
const previousAdminSessionSecret = process.env.ADMIN_SESSION_SECRET;
const previousCorsOrigin = process.env.CORS_ORIGIN;

before(async () => {
  process.env.ADMIN_USERNAME = "test-admin";
  process.env.ADMIN_PASSWORD = "test-admin-password";
  process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret";
  process.env.CORS_ORIGIN = "http://localhost:3000";
  delete process.env.ADMIN_TOKEN;
  resetAdminSecurityState();

  const app = createServer();

  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Servidor de teste nao abriu uma porta TCP.");
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (previousAdminUsername === undefined) {
    delete process.env.ADMIN_USERNAME;
  } else {
    process.env.ADMIN_USERNAME = previousAdminUsername;
  }

  if (previousAdminToken === undefined) {
    delete process.env.ADMIN_TOKEN;
  } else {
    process.env.ADMIN_TOKEN = previousAdminToken;
  }

  if (previousAdminPassword === undefined) {
    delete process.env.ADMIN_PASSWORD;
  } else {
    process.env.ADMIN_PASSWORD = previousAdminPassword;
  }

  if (previousAdminSessionSecret === undefined) {
    delete process.env.ADMIN_SESSION_SECRET;
  } else {
    process.env.ADMIN_SESSION_SECRET = previousAdminSessionSecret;
  }

  if (previousCorsOrigin === undefined) {
    delete process.env.CORS_ORIGIN;
  } else {
    process.env.CORS_ORIGIN = previousCorsOrigin;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
  await prisma.$disconnect();
});

test("GET /health retorna cidade fixa de Parnaiba", async () => {
  const response = await fetch(`${baseUrl}/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.city.ibgeCode, "2207702");
  assert.equal(body.city.uf, "PI");
});

test("GET /api/records bloqueia filtro por outro municipio", async () => {
  const response = await fetch(`${baseUrl}/api/records?city=Outra`);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error.code, "invalid_query");
  assert.deepEqual(body.error.details.blockedParams, ["city"]);
});

test("GET /api/records rejeita fonte fora da lista permitida", async () => {
  const response = await fetch(`${baseUrl}/api/records?source=fonte_invalida`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.error.code, "not_found");
});

test("GET /api/charts/yearly-evolution exige source", async () => {
  const response = await fetch(`${baseUrl}/api/charts/yearly-evolution`);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error.code, "invalid_query");
});

test("GET /api/sources/:slug rejeita fonte fora da lista permitida", async () => {
  const response = await fetch(`${baseUrl}/api/sources/fonte_invalida`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.error.code, "not_found");
});

test("GET /api/records/export.csv nao existe mais na area publica", async () => {
  const response = await fetch(`${baseUrl}/api/records/export.csv`);

  assert.equal(response.status, 404);
});

test("GET /api/admin/records/export.csv exige autenticacao administrativa", async () => {
  const response = await fetch(`${baseUrl}/api/admin/records/export.csv`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, "unauthorized");
});

test("POST /api/admin/auth/login rejeita senha invalida", async () => {
  resetAdminSecurityState();

  const response = await fetch(`${baseUrl}/api/admin/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ username: "test-admin", password: "senha-errada" })
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, "unauthorized");
});

test("POST /api/admin/auth/login rejeita origem fora da lista permitida", async () => {
  resetAdminSecurityState();

  const response = await fetch(`${baseUrl}/api/admin/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://evil.example"
    },
    body: JSON.stringify({ username: "test-admin", password: "test-admin-password" })
  });
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.error.code, "forbidden");
});

test("POST /api/admin/auth/login aplica limite de tentativas", async () => {
  resetAdminSecurityState();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ username: "test-admin", password: `senha-errada-${attempt}` })
    });

    assert.equal(response.status, 401);
  }

  const blockedResponse = await fetch(`${baseUrl}/api/admin/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ username: "test-admin", password: "senha-errada-final" })
  });
  const blockedBody = await blockedResponse.json();

  assert.equal(blockedResponse.status, 429);
  assert.equal(blockedBody.error.code, "rate_limited");
});

test("POST /api/admin/auth/login cria sessao administrativa", async () => {
  resetAdminSecurityState();

  const response = await fetch(`${baseUrl}/api/admin/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ username: "test-admin", password: "test-admin-password" })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.authenticated, true);
  assert.match(response.headers.get("set-cookie") ?? "", /painel_admin_session=/);
});

test("GET /api/admin/auth/me aceita sessao administrativa", async () => {
  resetAdminSecurityState();

  const loginResponse = await fetch(`${baseUrl}/api/admin/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ username: "test-admin", password: "test-admin-password" })
  });
  const cookie = loginResponse.headers.get("set-cookie") ?? "";
  const sessionCookie = cookie.split(";")[0];

  const response = await fetch(`${baseUrl}/api/admin/auth/me`, {
    headers: {
      cookie: sessionCookie
    }
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.authenticated, true);
});

test("GET /api/admin/auth/me aceita sessao mesmo com cookie antigo invalido", async () => {
  resetAdminSecurityState();

  const loginResponse = await fetch(`${baseUrl}/api/admin/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ username: "test-admin", password: "test-admin-password" })
  });
  const cookie = loginResponse.headers.get("set-cookie") ?? "";
  const sessionCookie = cookie.split(";")[0];

  const response = await fetch(`${baseUrl}/api/admin/auth/me`, {
    headers: {
      cookie: `painel_admin_session=valor-antigo-invalido; ${sessionCookie}`
    }
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.authenticated, true);
});

// Sobe uma instância à parte com TRUST_PROXY definido (simula o backend atrás de um proxy local).
async function withTrustedProxyServer(trustProxy: string, run: (url: string) => Promise<void>) {
  const previousTrustProxy = process.env.TRUST_PROXY;
  process.env.TRUST_PROXY = trustProxy;
  const proxiedServer = await new Promise<Server>((resolve) => {
    const listener = createServer().listen(0, "127.0.0.1", () => resolve(listener));
  });

  try {
    const address = proxiedServer.address();
    assert.ok(address && typeof address !== "string");
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    if (previousTrustProxy === undefined) {
      delete process.env.TRUST_PROXY;
    } else {
      process.env.TRUST_PROXY = previousTrustProxy;
    }
    await new Promise<void>((resolve) => proxiedServer.close(() => resolve()));
  }
}

function loginFrom(url: string, forwardedFor: string, password: string) {
  return fetch(`${url}/api/admin/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": forwardedFor },
    body: JSON.stringify({ username: "test-admin", password })
  });
}

test("parseTrustProxy aceita numero e lista, recusa true", () => {
  assert.equal(parseTrustProxy(undefined), false);
  assert.equal(parseTrustProxy(""), false);
  assert.equal(parseTrustProxy("false"), false);
  assert.equal(parseTrustProxy("1"), 1);
  assert.equal(parseTrustProxy("loopback, 172.16.0.0/12"), "loopback, 172.16.0.0/12");
  assert.equal(parseTrustProxy("true"), false);
});

test("S4: sem TRUST_PROXY, X-Forwarded-For forjado nao muda o IP do bloqueio", async () => {
  resetAdminSecurityState();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await loginFrom(baseUrl, `203.0.113.${attempt}`, "senha-errada");
    assert.equal(response.status, 401);
  }

  // Trocar o cabeçalho não escapa do bloqueio: o IP considerado é o da conexão.
  const response = await loginFrom(baseUrl, "198.51.100.99", "senha-errada");
  assert.equal(response.status, 429);
  resetAdminSecurityState();
});

test("S5: com proxy confiavel, tentativas de terceiros nao trancam o administrador", async () => {
  resetAdminSecurityState();

  await withTrustedProxyServer("loopback", async (url) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.equal((await loginFrom(url, "203.0.113.10", `errada-${attempt}`)).status, 401);
    }

    assert.equal((await loginFrom(url, "203.0.113.10", "test-admin-password")).status, 429);
    assert.equal((await loginFrom(url, "198.51.100.20", "test-admin-password")).status, 200);
  });

  resetAdminSecurityState();
});

test("S6: JSON invalido devolve 400 em JSON, sem stack trace", async () => {
  const response = await fetch(`${baseUrl}/api/admin/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: "{x"
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error.code, "invalid_body");
  assert.doesNotMatch(JSON.stringify(body), /at .*\.(ts|js)/);
});

test("S6: corpo grande demais devolve 413 em JSON", async () => {
  const response = await fetch(`${baseUrl}/api/admin/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify({ username: "x".repeat(200_000) })
  });
  const body = await response.json();

  assert.equal(response.status, 413);
  assert.equal(body.error.code, "payload_too_large");
});

test("S9: ADMIN_COOKIE_SECURE=true marca o cookie de sessao como Secure", async () => {
  const previous = process.env.ADMIN_COOKIE_SECURE;
  resetAdminSecurityState();

  try {
    for (const [value, expectSecure] of [["false", false], ["true", true]] as const) {
      process.env.ADMIN_COOKIE_SECURE = value;
      const response = await fetch(`${baseUrl}/api/admin/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({ username: "test-admin", password: "test-admin-password" })
      });
      const cookie = response.headers.get("set-cookie") ?? "";

      assert.equal(response.status, 200);
      assert.equal(/;\s*Secure/i.test(cookie), expectSecure, `ADMIN_COOKIE_SECURE=${value}: ${cookie}`);
      assert.match(cookie, /HttpOnly/i);
      assert.match(cookie, /SameSite=Strict/i);
    }
  } finally {
    if (previous === undefined) {
      delete process.env.ADMIN_COOKIE_SECURE;
    } else {
      process.env.ADMIN_COOKIE_SECURE = previous;
    }
  }
});

test("S9: avisa quando o site usa HTTPS e o cookie nao e Secure", () => {
  const previousOrigin = process.env.CORS_ORIGIN;
  const previousSecure = process.env.ADMIN_COOKIE_SECURE;

  try {
    process.env.CORS_ORIGIN = "https://painel.exemplo.gov.br";
    process.env.ADMIN_COOKIE_SECURE = "false";
    assert.ok(getAdminCookieSecurityWarning());

    process.env.ADMIN_COOKIE_SECURE = "true";
    assert.equal(getAdminCookieSecurityWarning(), null);

    process.env.CORS_ORIGIN = "http://localhost:3000";
    process.env.ADMIN_COOKIE_SECURE = "false";
    assert.equal(getAdminCookieSecurityWarning(), null);
  } finally {
    process.env.CORS_ORIGIN = previousOrigin;
    if (previousSecure === undefined) {
      delete process.env.ADMIN_COOKIE_SECURE;
    } else {
      process.env.ADMIN_COOKIE_SECURE = previousSecure;
    }
  }
});

test("S11: logout invalida a sessao no servidor (cookie copiado deixa de valer)", async () => {
  resetAdminSecurityState();
  const loginResponse = await fetch(`${baseUrl}/api/admin/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify({ username: "test-admin", password: "test-admin-password" })
  });
  const sessionCookie = (loginResponse.headers.get("set-cookie") ?? "").split(";")[0];
  const me = () => fetch(`${baseUrl}/api/admin/auth/me`, { headers: { cookie: sessionCookie } });

  assert.equal((await me()).status, 200);

  const logout = await fetch(`${baseUrl}/api/admin/auth/logout`, {
    method: "POST",
    headers: { cookie: sessionCookie, origin: "http://localhost:3000" }
  });
  assert.equal(logout.status, 200);
  assert.equal((await me()).status, 401);
});

test("S17: enderecos privados ficam fora do limite de requisicoes", () => {
  for (const ip of ["127.0.0.1", "::1", "::ffff:172.18.0.1", "10.1.2.3", "192.168.0.10", "fd00::1"]) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "203.0.113.5", "::ffff:200.1.2.3", "2001:db8::1", undefined]) {
    assert.equal(isPrivateAddress(ip), false, String(ip));
  }
});

test("S17: IP publico acima do limite recebe 429; outro IP segue normal", async () => {
  const previousLimit = process.env.RATE_LIMIT_PER_MINUTE;
  process.env.RATE_LIMIT_PER_MINUTE = "3";

  try {
    await withTrustedProxyServer("loopback", async (url) => {
      const get = (ip: string) => fetch(`${url}/api/sources`, { headers: { "x-forwarded-for": ip } });

      for (let attempt = 0; attempt < 3; attempt += 1) {
        assert.equal((await get("203.0.113.50")).status, 200);
      }

      const limited = await get("203.0.113.50");
      const body = await limited.json();
      assert.equal(limited.status, 429);
      assert.equal(body.error.code, "rate_limited");
      assert.ok(limited.headers.get("ratelimit"), "cabecalho RateLimit ausente");
      assert.equal((await get("198.51.100.60")).status, 200);
      assert.equal((await fetch(`${url}/health`, { headers: { "x-forwarded-for": "203.0.113.50" } })).status, 200);
    });
  } finally {
    if (previousLimit === undefined) {
      delete process.env.RATE_LIMIT_PER_MINUTE;
    } else {
      process.env.RATE_LIMIT_PER_MINUTE = previousLimit;
    }
  }
});

test("S15: avisa configuracao fraca so quando o sistema parece publicado", () => {
  const keys = ["CORS_ORIGIN", "DATABASE_URL", "ADMIN_PASSWORD", "ADMIN_SESSION_SECRET"] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  try {
    process.env.DATABASE_URL = "postgresql://postgres:postgres@postgres:5432/pet_saude";
    process.env.ADMIN_PASSWORD = "curta";
    process.env.ADMIN_SESSION_SECRET = "curto";

    process.env.CORS_ORIGIN = "http://localhost:3000";
    assert.deepEqual(getWeakConfigWarnings(), []);

    process.env.CORS_ORIGIN = "https://painel.exemplo.gov.br";
    assert.equal(getWeakConfigWarnings().length, 3);

    process.env.DATABASE_URL = "postgresql://postgres:Senha-Forte-Do-Banco-2026@postgres:5432/pet_saude";
    process.env.ADMIN_PASSWORD = "Senha-Forte-Admin-2026";
    process.env.ADMIN_SESSION_SECRET = "x".repeat(48);
    assert.deepEqual(getWeakConfigWarnings(), []);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
});

test("S16: token Bearer ligado aceita so o valor exato (comparacao em tempo constante)", async () => {
  const previousAllow = process.env.ADMIN_ALLOW_BEARER_TOKEN;
  const previousToken = process.env.ADMIN_TOKEN;
  process.env.ADMIN_ALLOW_BEARER_TOKEN = "true";
  process.env.ADMIN_TOKEN = "token-de-teste-1234567890";

  try {
    const me = (authorization: string) =>
      fetch(`${baseUrl}/api/admin/auth/me`, { headers: { authorization } });

    assert.equal((await me("Bearer token-de-teste-1234567890")).status, 200);
    assert.equal((await me("Bearer token-de-teste-1234567891")).status, 401);
    assert.equal((await me("Bearer x")).status, 401);
    assert.equal((await me("")).status, 401);
  } finally {
    for (const [key, value] of [["ADMIN_ALLOW_BEARER_TOKEN", previousAllow], ["ADMIN_TOKEN", previousToken]] as const) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});

