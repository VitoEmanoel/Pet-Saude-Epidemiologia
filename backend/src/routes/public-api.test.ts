import assert from "node:assert/strict";
import type { Server } from "node:http";
import { after, before, test } from "node:test";
import { prisma } from "../database/prisma";
import { resetAdminSecurityState } from "../middleware/admin-auth";
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
