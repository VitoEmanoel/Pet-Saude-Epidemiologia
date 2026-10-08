import "../config/env";
import { prisma } from "../database/prisma";
import { AdminUserError, listAdminUsers, normalizeUsername, resetAdminUserPassword } from "../modules/admin/admin-users.service";

// Recuperação de acesso pela linha de comando do servidor (7.4), para quando ninguém consegue
// entrar no admin. Em produção (sem npm na imagem):
//   docker compose -f docker-compose.prod.yml --env-file .env exec -T backend node backend/dist/scripts/admin-user.js listar
//   docker compose -f docker-compose.prod.yml --env-file .env exec -T backend node backend/dist/scripts/admin-user.js nova-senha <usuario>

async function main() {
  const [command, usernameArg] = process.argv.slice(2);

  if (command === "listar") {
    for (const user of await listAdminUsers()) {
      console.log(`${user.username}\t${user.name}\t${user.role === "admin" ? "administrador" : "equipe"}\t${user.active ? "ativo" : "inativo"}`);
    }
    return;
  }

  if (command === "nova-senha" && usernameArg) {
    const user = await prisma.adminUser.findUnique({ where: { username: normalizeUsername(usernameArg) } });

    if (!user) {
      throw new AdminUserError(404, "not_found", `Usuário "${usernameArg}" não encontrado. Veja a lista com: listar`);
    }

    const { temporaryPassword } = await resetAdminUserPassword(user.id);
    await prisma.adminUser.update({ where: { id: user.id }, data: { active: true } });
    console.log(`Senha temporária de ${user.username}: ${temporaryPassword}`);
    console.log("A pessoa troca a senha no primeiro acesso. As sessões abertas dessa conta foram encerradas.");
    return;
  }

  console.log("Uso: admin-user listar | admin-user nova-senha <usuario>");
  process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
