import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const setupEnv = loadEnvFiles();

const steps = [
  {
    label: "Subindo PostgreSQL e Redis",
    command: "docker",
    args: ["compose", "up", "-d"],
    optional: true
  },
  {
    label: "Gerando Prisma Client",
    command: "npm",
    args: ["run", "prisma:generate"]
  },
  {
    label: "Aplicando migrations",
    command: "npm",
    args: ["run", "prisma:deploy"]
  },
  {
    label: "Cadastrando fontes",
    command: "npm",
    args: ["run", "prisma:seed"]
  },
  {
    label: "Sincronizando dados DATASUS/TABNET",
    command: "npm",
    args: ["run", "sync:data"]
  }
];

for (const step of steps) {
  console.log(`\n==> ${step.label}`);
  try {
    await run(step.command, step.args);
  } catch (error) {
    if (!step.optional) {
      throw error;
    }

    console.warn(`Aviso: ${error instanceof Error ? error.message : "etapa opcional falhou"}`);
    console.warn("Continuando. Se o banco nao estiver rodando, a etapa do Prisma vai falhar.");
  }
}

console.log("\nSetup concluido. Rode npm run dev para abrir o sistema.");

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: setupEnv,
      stdio: "inherit",
      shell: process.platform === "win32"
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      const reason = signal ? `signal ${signal}` : `code ${code}`;
      reject(new Error(`${command} ${args.join(" ")} falhou com ${reason}.`));
    });
  });
}

function loadEnvFiles() {
  const env = { ...process.env };

  for (const filePath of [path.resolve(".env"), path.resolve("backend/.env")]) {
    if (!existsSync(filePath)) {
      continue;
    }

    const content = readFileSync(filePath, "utf8");

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");

      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      env[key] = unquote(rawValue);
    }
  }

  return env;
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
