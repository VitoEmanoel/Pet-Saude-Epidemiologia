import assert from "node:assert/strict";
import type { Server } from "node:http";
import { after, before, test } from "node:test";
import { prisma } from "../../database/prisma";
import { resetAdminSecurityState } from "../../middleware/admin-auth";
import { createServer } from "../../server";
import { refreshHiddenSources } from "./source-publication";

// 7.5: o administrador tira uma fonte do site público e a devolve (banco de TESTE, S10).

const SOURCE = "hanseniase_sinan";
let server: Server;
let baseUrl: string;
let adminCookie = "";
const saved = { ...process.env };

async function call(path: string, options: { method?: string; body?: unknown; cookie?: string } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      ...(options.cookie ? { cookie: options.cookie } : {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  const isJson = (response.headers.get("content-type") ?? "").includes("json");
  return { status: response.status, json: isJson && text ? JSON.parse(text) : null, headers: response.headers };
}

before(async () => {
  const database = new URL(process.env.DATABASE_URL ?? "postgresql://x@x/x").pathname.replace(/^\//, "");
  assert.ok(database.endsWith("_test"), `source-publication.test só roda no banco de teste (está em "${database}")`);
  process.env.ADMIN_USERNAME = "fontes-admin";
  process.env.ADMIN_PASSWORD = "senha-do-admin-das-fontes";
  process.env.ADMIN_SESSION_SECRET = "segredo-de-sessao-dos-testes-de-fontes";
  process.env.CORS_ORIGIN = "http://localhost:3000";
  resetAdminSecurityState();
  await prisma.adminSession.deleteMany({});
  await prisma.adminUser.deleteMany({});
  await prisma.dataSource.updateMany({ where: { slug: SOURCE }, data: { active: true } });
  await refreshHiddenSources();
  const app = createServer();
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  const login = await call("/api/admin/auth/login", { method: "POST", body: { username: "fontes-admin", password: "senha-do-admin-das-fontes" } });
  adminCookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
});

after(async () => {
  await prisma.dataSource.updateMany({ where: { slug: SOURCE }, data: { active: true } });
  await refreshHiddenSources();
  await prisma.adminSession.deleteMany({});
  await prisma.adminUser.deleteMany({});
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
  for (const key of ["ADMIN_USERNAME", "ADMIN_PASSWORD", "ADMIN_SESSION_SECRET", "CORS_ORIGIN"] as const) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

test("7.5: fonte tirada do site some de todas as rotas públicas; o admin continua vendo e pode devolver", async () => {
  const slugs = async () => (await call("/api/sources")).json.sources.map((source: { slug: string }) => source.slug);
  assert.ok((await slugs()).includes(SOURCE));

  const off = await call(`/api/admin/sources/${SOURCE}`, { method: "PATCH", cookie: adminCookie, body: { published: false } });
  assert.deepEqual(off.json, { source: SOURCE, published: false });

  assert.ok(!(await slugs()).includes(SOURCE), "fora da lista pública");
  for (const path of [
    `/api/sources/${SOURCE}`,
    `/api/sources/${SOURCE}/summary`,
    `/api/sources/${SOURCE}/filters`,
    `/api/charts/yearly-evolution?source=${SOURCE}`,
    `/api/records?source=${SOURCE}`,
    `/api/indicators?source=${SOURCE}`
  ]) {
    assert.equal((await call(path)).status, 404, path);
  }
  const overview = (await call("/api/dashboard/overview")).json;
  assert.ok(!overview.casesBySource.some((item: { slug: string }) => item.slug === SOURCE), "fora da visão geral");

  const adminList = (await call("/api/admin/sources", { cookie: adminCookie })).json.sources;
  assert.equal(adminList.find((item: { source: { slug: string } }) => item.source.slug === SOURCE)?.published, false, "o admin vê a fonte fora do site");
  assert.ok(await prisma.adminAuditLog.findFirst({ where: { action: "admin_source_publish", actor: "fontes-admin" }, orderBy: { id: "desc" } }));

  await call(`/api/admin/sources/${SOURCE}`, { method: "PATCH", cookie: adminCookie, body: { published: true } });
  assert.ok((await slugs()).includes(SOURCE), "de volta ao site");
  assert.equal((await call(`/api/sources/${SOURCE}/summary`)).status, 200);
});

test("7.5: só administrador tira fonte do site; pedido inválido é recusado", async () => {
  const created = await call("/api/admin/users", { method: "POST", cookie: adminCookie, body: { username: "equipe-fontes", name: "Equipe", role: "member", permissions: ["sincronizar"] } });
  await prisma.adminUser.update({ where: { id: created.json.user.id }, data: { mustChangePassword: false } });
  const login = await call("/api/admin/auth/login", { method: "POST", body: { username: "equipe-fontes", password: created.json.temporaryPassword } });
  const memberCookie = (login.headers.get("set-cookie") ?? "").split(";")[0];

  assert.equal((await call(`/api/admin/sources/${SOURCE}`, { method: "PATCH", cookie: memberCookie, body: { published: false } })).status, 403);
  assert.equal((await call("/api/admin/sources", { cookie: memberCookie })).status, 200, "a equipe vê a lista");
  assert.equal((await call(`/api/admin/sources/${SOURCE}`, { method: "PATCH", cookie: adminCookie, body: { published: "não" } })).status, 400);
  assert.equal((await call("/api/admin/sources/inexistente", { method: "PATCH", cookie: adminCookie, body: { published: false } })).status, 404);
});
