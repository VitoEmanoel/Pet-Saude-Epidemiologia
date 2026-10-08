import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { Prisma, type AdminUser } from "@prisma/client";
import { prisma } from "../../database/prisma";

// Contas individuais da área administrativa (7.4). Cada pessoa entra com o próprio usuário e
// a auditoria registra quem fez cada ação. Senhas só como hash scrypt (sal aleatório por senha).

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keyLength: number, options: { N: number; r: number; p: number }) => Promise<Buffer>;

export const ADMIN_ROLES = ["admin", "member"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

// O que o administrador escolhe para cada pessoa da equipe. Ver o painel, as fontes e o
// histórico de sincronizações é de todos; gerenciar usuários é só do papel "admin".
export const ADMIN_PERMISSIONS = ["exportar", "sincronizar", "populacao", "auditoria"] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

/** Permissões que valem de fato: administrador tem todas. */
export function effectivePermissions(user: { role: string; permissions: string[] }): AdminPermission[] {
  return user.role === "admin"
    ? [...ADMIN_PERMISSIONS]
    : ADMIN_PERMISSIONS.filter((permission) => user.permissions.includes(permission));
}
export const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 200;
const SCRYPT = { N: 16384, r: 8, p: 1, keyLength: 64 };
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,49}$/;

/** Dados de um usuário que podem sair da API (nunca o hash da senha). */
export type PublicAdminUser = Pick<AdminUser, "id" | "username" | "name" | "role" | "permissions" | "active" | "mustChangePassword" | "lastLoginAt" | "createdAt">;

export class AdminUserError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "AdminUserError";
  }
}

export function toPublicUser(user: AdminUser): PublicAdminUser {
  const { id, username, name, role, active, mustChangePassword, lastLoginAt, createdAt } = user;
  return { id, username, name, role, permissions: effectivePermissions(user), active, mustChangePassword, lastLoginAt, createdAt };
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, SCRYPT.keyLength, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, n, r, p, salt, hash] = stored.split("$");

  if (scheme !== "scrypt" || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "base64url");
  const actual = await scrypt(password, Buffer.from(salt, "base64url"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p)
  });

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Hash de uma senha qualquer: usuário inexistente também gasta o tempo do scrypt, para o tempo
// de resposta não revelar quais usuários existem.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword(randomBytes(16).toString("base64url")));

export function generateTemporaryPassword() {
  // 18 caracteres de [A-Za-z0-9_-], ~108 bits: forte e fácil de copiar.
  return randomBytes(14).toString("base64url").slice(0, 18);
}

export function normalizeUsername(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validateUsername(username: string) {
  if (!USERNAME_PATTERN.test(username)) {
    throw new AdminUserError(
      400,
      "invalid_username",
      "Usuário inválido: de 3 a 50 caracteres, só letras minúsculas sem acento, números, ponto, hífen ou sublinhado."
    );
  }
}

function validateName(value: unknown) {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

  if (name.length < 2 || name.length > 100) {
    throw new AdminUserError(400, "invalid_name", "Informe o nome da pessoa (de 2 a 100 caracteres).");
  }

  return name;
}

function validateRole(value: unknown): AdminRole {
  if (!ADMIN_ROLES.includes(value as AdminRole)) {
    throw new AdminUserError(400, "invalid_role", "Papel inválido: use administrador ou equipe.");
  }

  return value as AdminRole;
}

function validatePermissions(value: unknown): AdminPermission[] {
  if (!Array.isArray(value) || value.some((item) => !ADMIN_PERMISSIONS.includes(item as AdminPermission))) {
    throw new AdminUserError(400, "invalid_permissions", `Permissões inválidas: use ${ADMIN_PERMISSIONS.join(", ")}.`);
  }

  return ADMIN_PERMISSIONS.filter((permission) => value.includes(permission));
}

export function validateNewPassword(password: unknown) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    throw new AdminUserError(400, "weak_password", `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }

  return password;
}

/**
 * Primeiro acesso depois da implantação do 7.4: sem nenhum usuário, a conta do .env
 * (ADMIN_USERNAME/ADMIN_PASSWORD) vira o primeiro administrador, com a mesma senha. Depois disso
 * o .env não é mais usado para entrar: as senhas ficam só no banco.
 */
export async function ensureBootstrapAdmin() {
  if ((await prisma.adminUser.count()) > 0) {
    return;
  }

  const username = normalizeUsername(process.env.ADMIN_USERNAME);
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    return;
  }

  try {
    await prisma.adminUser.create({
      data: { username, name: "Administrador", role: "admin", passwordHash: await hashPassword(password) }
    });
  } catch (error) {
    // Dois logins ao mesmo tempo no primeiro acesso: o outro já criou.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
      throw error;
    }
  }
}

/** Usuário ativo com essa senha, ou null (sem revelar se o usuário existe). */
export async function authenticateAdminUser(usernameInput: unknown, password: unknown) {
  await ensureBootstrapAdmin();
  const username = normalizeUsername(usernameInput);
  const user = username ? await prisma.adminUser.findUnique({ where: { username } }) : null;

  if (typeof password !== "string" || !user || !user.active) {
    await verifyPassword(typeof password === "string" ? password : "", await getDummyHash());
    return null;
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    return null;
  }

  return prisma.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
}

export async function listAdminUsers() {
  const users = await prisma.adminUser.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  return users.map(toPublicUser);
}

/** Cria a conta com senha temporária (a pessoa troca no primeiro acesso). */
export async function createAdminUser(input: { username: unknown; name: unknown; role: unknown; permissions?: unknown }) {
  const username = normalizeUsername(input.username);
  validateUsername(username);
  const name = validateName(input.name);
  const role = validateRole(input.role);
  const permissions = role === "admin" ? [] : validatePermissions(input.permissions ?? []);
  const temporaryPassword = generateTemporaryPassword();

  try {
    const user = await prisma.adminUser.create({
      data: { username, name, role, permissions, passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true }
    });
    return { user: toPublicUser(user), temporaryPassword };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AdminUserError(409, "username_taken", `Já existe uma conta com o usuário "${username}".`);
    }
    throw error;
  }
}

async function findUserOrThrow(id: number) {
  const user = Number.isInteger(id) ? await prisma.adminUser.findUnique({ where: { id } }) : null;

  if (!user) {
    throw new AdminUserError(404, "not_found", "Usuário não encontrado.");
  }

  return user;
}

/** O sistema nunca fica sem um administrador ativo. */
async function assertAnotherActiveAdmin(exceptId: number) {
  const others = await prisma.adminUser.count({ where: { role: "admin", active: true, id: { not: exceptId } } });

  if (others === 0) {
    throw new AdminUserError(409, "last_admin", "Não é possível: este é o único administrador ativo.");
  }
}

/** Muda nome, papel ou situação (ativo/inativo). Desativar derruba as sessões abertas da pessoa. */
export async function updateAdminUser(id: number, actorId: number, input: { name?: unknown; role?: unknown; permissions?: unknown; active?: unknown }) {
  const user = await findUserOrThrow(id);
  const data: Prisma.AdminUserUpdateInput = {};

  if (input.name !== undefined) {
    data.name = validateName(input.name);
  }

  if (input.role !== undefined) {
    const role = validateRole(input.role);
    if (role !== user.role && user.role === "admin") {
      if (id === actorId) {
        throw new AdminUserError(409, "self_change", "Você não pode tirar o seu próprio papel de administrador.");
      }
      await assertAnotherActiveAdmin(id);
    }
    data.role = role;
  }

  if (input.permissions !== undefined) {
    data.permissions = validatePermissions(input.permissions);
  }

  if (input.active !== undefined) {
    if (typeof input.active !== "boolean") {
      throw new AdminUserError(400, "invalid_active", "Situação inválida.");
    }
    if (!input.active && user.active) {
      if (id === actorId) {
        throw new AdminUserError(409, "self_change", "Você não pode desativar a sua própria conta.");
      }
      if (user.role === "admin") {
        await assertAnotherActiveAdmin(id);
      }
    }
    data.active = input.active;
  }

  const updated = await prisma.adminUser.update({ where: { id }, data });

  if (data.active === false) {
    await revokeUserSessions(id);
  }

  return { before: toPublicUser(user), user: toPublicUser(updated) };
}

/** Nova senha temporária (a pessoa troca no próximo acesso); derruba as sessões abertas. */
export async function resetAdminUserPassword(id: number) {
  await findUserOrThrow(id);
  const temporaryPassword = generateTemporaryPassword();
  const user = await prisma.adminUser.update({
    where: { id },
    data: { passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true }
  });
  await revokeUserSessions(id);
  return { user: toPublicUser(user), temporaryPassword };
}

/** A própria pessoa troca a senha (precisa da atual). As outras sessões dela são encerradas. */
export async function changeOwnPassword(id: number, currentPassword: unknown, newPassword: unknown, keepSessionId?: string) {
  const user = await findUserOrThrow(id);

  if (typeof currentPassword !== "string" || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new AdminUserError(400, "wrong_password", "A senha atual não confere.");
  }

  const password = validateNewPassword(newPassword);

  if (password === currentPassword) {
    throw new AdminUserError(400, "same_password", "A nova senha precisa ser diferente da atual.");
  }

  await prisma.adminUser.update({
    where: { id },
    data: { passwordHash: await hashPassword(password), mustChangePassword: false }
  });
  await prisma.adminSession.updateMany({
    where: { userId: id, revokedAt: null, ...(keepSessionId ? { id: { not: keepSessionId } } : {}) },
    data: { revokedAt: new Date() }
  });
}

/**
 * Exclui a conta. As linhas da auditoria continuam (guardam o nome do usuário como texto).
 * Para quem já trabalhou no sistema, o normal é desativar.
 */
export async function deleteAdminUser(id: number, actorId: number) {
  const user = await findUserOrThrow(id);

  if (id === actorId) {
    throw new AdminUserError(409, "self_change", "Você não pode excluir a sua própria conta.");
  }

  if (user.role === "admin" && user.active) {
    await assertAnotherActiveAdmin(id);
  }

  await prisma.adminUser.delete({ where: { id } });
  return toPublicUser(user);
}

async function revokeUserSessions(userId: number) {
  await prisma.adminSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}
