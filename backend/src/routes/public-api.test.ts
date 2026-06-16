import assert from "node:assert/strict";
import type { Server } from "node:http";
import { after, before, test } from "node:test";
import { prisma } from "../database/prisma";
import { createServer } from "../server";

let server: Server;
let baseUrl: string;
const previousAdminToken = process.env.ADMIN_TOKEN;

before(async () => {
  process.env.ADMIN_TOKEN = "test-admin-token";

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
  if (previousAdminToken === undefined) {
    delete process.env.ADMIN_TOKEN;
  } else {
    process.env.ADMIN_TOKEN = previousAdminToken;
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

test("GET /api/admin/records/export.csv exige token administrativo", async () => {
  const response = await fetch(`${baseUrl}/api/admin/records/export.csv`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, "unauthorized");
});
