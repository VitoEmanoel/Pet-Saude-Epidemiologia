import assert from "node:assert/strict";
import type { Server } from "node:http";
import { after, before, beforeEach, test } from "node:test";
import { prisma } from "../../database/prisma";
import { resetAdminSecurityState } from "../../middleware/admin-auth";
import { createServer } from "../../server";
import { hashPassword, verifyPassword } from "./admin-users.service";

// 7.4: contas individuais no admin, pela API e no banco de TESTE (S10).

let server: Server;
let baseUrl: string;
const BOOT_USER = "boot-admin";
const BOOT_PASSWORD = "senha-inicial-do-env-123";
const saved = { ...process.env };

type Session = { cookie: string };

async function call(path: string, options: { method?: string; body?: unknown; session?: Session } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      ...(options.session ? { cookie: options.session.cookie } : {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  const isJson = (response.headers.get("content-type") ?? "").includes("json");
  return { status: response.status, json: isJson && text ? JSON.parse(text) : null, headers: response.headers };
}

async function login(username: string, password: string): Promise<Session & { status: number; json: any }> {
  const result = await call("/api/admin/auth/login", { method: "POST", body: { username, password } });
  const cookie = (result.headers.get("set-cookie") ?? "").split(";")[0];
  return { ...result, cookie };
}

before(async () => {
  const database = new URL(process.env.DATABASE_URL ?? "postgresql://x@x/x").pathname.replace(/^\//, "");
  assert.ok(database.endsWith("_test"), `admin-users.test só roda no banco de teste (está em "${database}")`);
  process.env.ADMIN_USERNAME = BOOT_USER;
  process.env.ADMIN_PASSWORD = BOOT_PASSWORD;
  process.env.ADMIN_SESSION_SECRET = "segredo-de-sessao-dos-testes-de-usuarios";
  process.env.CORS_ORIGIN = "http://localhost:3000";
  const app = createServer();
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

beforeEach(async () => {
  resetAdminSecurityState();
  await prisma.adminSession.deleteMany({});
  await prisma.adminUser.deleteMany({});
  await prisma.adminAuditLog.deleteMany({});
});

after(async () => {
  await prisma.adminSession.deleteMany({});
  await prisma.adminUser.deleteMany({});
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
  for (const key of ["ADMIN_USERNAME", "ADMIN_PASSWORD", "ADMIN_SESSION_SECRET", "CORS_ORIGIN"] as const) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

test("7.4: senha guardada só como hash scrypt, com sal diferente a cada vez", async () => {
  const first = await hashPassword("uma-senha-qualquer-123");
  const second = await hashPassword("uma-senha-qualquer-123");
  assert.match(first, /^scrypt\$16384\$8\$1\$/);
  assert.notEqual(first, second);
  assert.ok(!first.includes("uma-senha-qualquer"));
  assert.equal(await verifyPassword("uma-senha-qualquer-123", first), true);
  assert.equal(await verifyPassword("outra-senha-qualquer", first), false);
  assert.equal(await verifyPassword("x", "formato-invalido"), false);
});

test("7.4: primeiro acesso: a conta do .env vira o primeiro administrador (sem duplicar)", async () => {
  const first = await login(BOOT_USER, BOOT_PASSWORD);
  assert.equal(first.status, 200);
  assert.equal(first.json.mustChangePassword, false);
  await login(BOOT_USER, BOOT_PASSWORD);
  const users = await prisma.adminUser.findMany();
  assert.equal(users.length, 1);
  assert.equal(users[0].role, "admin");
  assert.notEqual(users[0].passwordHash, BOOT_PASSWORD);
  const me = await call("/api/admin/auth/me", { session: first });
  assert.deepEqual(me.json, { authenticated: true, username: BOOT_USER, name: "Administrador", role: "admin", permissions: ["exportar", "sincronizar", "populacao", "auditoria"], mustChangePassword: false });
});

test("7.4: conta nova com senha temporária: só troca a senha antes de usar o admin; auditoria com o nome dela", async () => {
  const admin = await login(BOOT_USER, BOOT_PASSWORD);
  const created = await call("/api/admin/users", { method: "POST", session: admin, body: { username: "Maria.Silva", name: "Maria Silva", role: "member" } });
  assert.equal(created.status, 201);
  assert.equal(created.json.user.username, "maria.silva", "usuário em minúsculas");
  assert.equal(created.json.user.passwordHash, undefined, "o hash nunca sai da API");
  const temporary: string = created.json.temporaryPassword;
  assert.equal(temporary.length, 18);

  const maria = await login("maria.silva", temporary);
  assert.equal(maria.status, 200);
  assert.equal(maria.json.mustChangePassword, true);
  assert.equal((await call("/api/admin/sync-history", { session: maria })).json.error.code, "password_change_required");
  assert.equal((await call("/api/admin/auth/me", { session: maria })).status, 200);

  const wrong = await call("/api/admin/account/password", { method: "POST", session: maria, body: { currentPassword: "errada", newPassword: "uma-senha-nova-forte" } });
  assert.equal(wrong.status, 400);
  const weak = await call("/api/admin/account/password", { method: "POST", session: maria, body: { currentPassword: temporary, newPassword: "curta" } });
  assert.match(weak.json.error.message, /pelo menos 12/);
  const changed = await call("/api/admin/account/password", { method: "POST", session: maria, body: { currentPassword: temporary, newPassword: "uma-senha-nova-forte" } });
  assert.equal(changed.status, 200);
  assert.equal((await call("/api/admin/sync-history", { session: maria })).status, 200, "liberado depois da troca");

  const actors = (await prisma.adminAuditLog.findMany({ where: { action: { in: ["admin_password_change", "admin_user_create"] }, status: "SUCCESS" } })).map((log) => [log.action, log.actor]);
  assert.deepEqual(actors.sort(), [["admin_password_change", "maria.silva"], ["admin_user_create", BOOT_USER]]);
});

test("7.4: equipe não gerencia usuários; administrador sim", async () => {
  const admin = await login(BOOT_USER, BOOT_PASSWORD);
  const { json } = await call("/api/admin/users", { method: "POST", session: admin, body: { username: "joao", name: "João", role: "member" } });
  await prisma.adminUser.update({ where: { id: json.user.id }, data: { mustChangePassword: false } });
  const joao = await login("joao", json.temporaryPassword);
  assert.equal((await call("/api/admin/users", { session: joao })).status, 403);
  assert.equal((await call("/api/admin/users", { method: "POST", session: joao, body: { username: "x-y-z", name: "X", role: "admin" } })).status, 403);
  assert.equal((await call("/api/admin/users", { session: admin })).json.users.length, 2);
});

test("7.4: desativar derruba as sessões e impede o login; reativar volta a permitir", async () => {
  const admin = await login(BOOT_USER, BOOT_PASSWORD);
  const { json } = await call("/api/admin/users", { method: "POST", session: admin, body: { username: "ana", name: "Ana", role: "member" } });
  const ana = await login("ana", json.temporaryPassword);
  assert.equal((await call("/api/admin/auth/me", { session: ana })).status, 200);

  const off = await call(`/api/admin/users/${json.user.id}`, { method: "PATCH", session: admin, body: { active: false } });
  assert.equal(off.json.user.active, false);
  assert.equal((await call("/api/admin/auth/me", { session: ana })).status, 401, "sessão derrubada na hora");
  assert.equal((await login("ana", json.temporaryPassword)).status, 401);

  await call(`/api/admin/users/${json.user.id}`, { method: "PATCH", session: admin, body: { active: true } });
  assert.equal((await login("ana", json.temporaryPassword)).status, 200);
  const log = await prisma.adminAuditLog.findFirst({ where: { action: "admin_user_update" }, orderBy: { id: "asc" } });
  assert.deepEqual(log?.metadata, { username: "ana", changes: { active: { de: true, para: false } } });
});

test("7.4: redefinir senha gera nova temporária e derruba as sessões abertas", async () => {
  const admin = await login(BOOT_USER, BOOT_PASSWORD);
  const { json } = await call("/api/admin/users", { method: "POST", session: admin, body: { username: "carla", name: "Carla", role: "member" } });
  const carla = await login("carla", json.temporaryPassword);
  const reset = await call(`/api/admin/users/${json.user.id}/reset-password`, { method: "POST", session: admin });
  assert.notEqual(reset.json.temporaryPassword, json.temporaryPassword);
  assert.equal((await call("/api/admin/auth/me", { session: carla })).status, 401);
  assert.equal((await login("carla", json.temporaryPassword)).status, 401, "a senha antiga não vale mais");
  const again = await login("carla", reset.json.temporaryPassword);
  assert.equal(again.json.mustChangePassword, true);
});

test("7.4: regras: nunca sem administrador, ninguém se desativa ou se exclui, usuário único e válido", async () => {
  const admin = await login(BOOT_USER, BOOT_PASSWORD);
  const self = await prisma.adminUser.findUniqueOrThrow({ where: { username: BOOT_USER } });
  assert.equal((await call(`/api/admin/users/${self.id}`, { method: "PATCH", session: admin, body: { active: false } })).status, 409);
  assert.equal((await call(`/api/admin/users/${self.id}`, { method: "PATCH", session: admin, body: { role: "member" } })).status, 409);
  assert.equal((await call(`/api/admin/users/${self.id}`, { method: "DELETE", session: admin })).status, 409);

  assert.equal((await call("/api/admin/users", { method: "POST", session: admin, body: { username: BOOT_USER, name: "Outro", role: "member" } })).status, 409);
  for (const username of ["ab", "maria silva", "joão", "<script>"]) {
    assert.equal((await call("/api/admin/users", { method: "POST", session: admin, body: { username, name: "Nome", role: "member" } })).status, 400, username);
  }
  assert.equal((await call("/api/admin/users", { method: "POST", session: admin, body: { username: "pedro", name: "Pedro", role: "dono" } })).status, 400);

  // Segundo administrador: agora o primeiro pode ser rebaixado por ele, mas não o contrário se ficar sozinho.
  const { json } = await call("/api/admin/users", { method: "POST", session: admin, body: { username: "chefe", name: "Chefe", role: "admin" } });
  const removed = await call(`/api/admin/users/${json.user.id}`, { method: "DELETE", session: admin });
  assert.equal(removed.status, 200);
  assert.equal(await prisma.adminUser.count({ where: { username: "chefe" } }), 0);
  assert.ok(await prisma.adminAuditLog.findFirst({ where: { action: "admin_user_delete" } }), "exclusão fica na auditoria");
});

test("7.4: usuário inexistente e senha errada dão a mesma resposta (não revela quem existe)", async () => {
  await login(BOOT_USER, BOOT_PASSWORD);
  const unknown = await login("ninguem", "qualquer-senha-123");
  const wrongPassword = await login(BOOT_USER, "senha-errada-123");
  assert.equal(unknown.status, 401);
  assert.deepEqual(unknown.json, wrongPassword.json);
});

test("7.4: permissões escolhidas pelo administrador valem no servidor (não só na tela)", async () => {
  const admin = await login(BOOT_USER, BOOT_PASSWORD);
  assert.deepEqual((await call("/api/admin/auth/me", { session: admin })).json.permissions, ["exportar", "sincronizar", "populacao", "auditoria"], "administrador tem todas");

  const created = await call("/api/admin/users", { method: "POST", session: admin, body: { username: "bia", name: "Bia", role: "member", permissions: ["exportar"] } });
  assert.deepEqual(created.json.user.permissions, ["exportar"]);
  await prisma.adminUser.update({ where: { id: created.json.user.id }, data: { mustChangePassword: false } });
  const bia = await login("bia", created.json.temporaryPassword);
  assert.deepEqual((await call("/api/admin/auth/me", { session: bia })).json.permissions, ["exportar"]);

  // Liberado para todos: painel, fontes e histórico de sincronizações.
  assert.equal((await call("/api/admin/sync-history", { session: bia })).status, 200);
  assert.equal((await call("/api/admin/source-health", { session: bia })).status, 200);
  // Com a permissão: baixar dados.
  assert.equal((await call("/api/admin/records/export.csv?source=tuberculose_sinan", { session: bia })).status, 200);
  // Sem a permissão: barrado com mensagem clara.
  const sync = await call("/api/admin/sync-all", { method: "POST", session: bia });
  assert.equal(sync.status, 403);
  assert.match(sync.json.error.message, /não tem permissão para sincronizar fontes/);
  assert.equal((await call("/api/admin/population", { session: bia })).status, 403);
  assert.equal((await call("/api/admin/population/model.csv", { session: bia })).status, 403);
  assert.equal((await call("/api/admin/audit-logs", { session: bia })).status, 403);
  assert.equal((await call("/api/admin/users", { session: bia })).status, 403);

  // Permissão dada depois vale na próxima ação, sem precisar sair e entrar.
  const updated = await call(`/api/admin/users/${created.json.user.id}`, { method: "PATCH", session: admin, body: { permissions: ["exportar", "auditoria"] } });
  assert.deepEqual(updated.json.user.permissions, ["exportar", "auditoria"]);
  assert.equal((await call("/api/admin/audit-logs", { session: bia })).status, 200);
  const log = await prisma.adminAuditLog.findFirst({ where: { action: "admin_user_update" } });
  assert.deepEqual(log?.metadata, { username: "bia", changes: { permissions: { de: ["exportar"], para: ["exportar", "auditoria"] } } });

  assert.equal((await call("/api/admin/users", { method: "POST", session: admin, body: { username: "caio", name: "Caio", role: "member", permissions: ["apagar-tudo"] } })).status, 400);
});
