import "./config/env";
import { prisma } from "./database/prisma";
import { startSyncScheduler } from "./modules/sync/sync-scheduler";
import { createServer } from "./server";

const port = Number(process.env.PORT ?? process.env.BACKEND_PORT ?? 3333);
const host = process.env.HOST ?? "0.0.0.0";
const app = createServer();
const syncScheduler = startSyncScheduler();

const server = app.listen(port, host, () => {
  console.log(`Backend do Painel Epidemiologico de Parnaiba rodando em http://${host}:${port}`);
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
