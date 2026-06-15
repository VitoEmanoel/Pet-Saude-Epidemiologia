import "./config/env";
import { prisma } from "./database/prisma";
import { startSyncScheduler } from "./modules/sync/sync-scheduler";
import { createServer } from "./server";

const port = Number(process.env.PORT ?? 3001);
const app = createServer();
const syncScheduler = startSyncScheduler();

const server = app.listen(port, () => {
  console.log(`Backend do Painel Epidemiologico de Parnaiba ouvindo na porta ${port}`);
});

async function shutdown() {
  syncScheduler?.stop();

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
}

process.on("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});
