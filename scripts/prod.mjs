import { spawn } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const runtimeDir = path.join(rootDir, ".runtime");
const pidDir = path.join(runtimeDir, "pids");
const logDir = path.join(runtimeDir, "logs");
const env = loadEnvFiles();
const action = process.argv[2] ?? "start";

const services = [
  {
    name: "backend",
    command: "npm",
    args: ["--workspace", "backend", "run", "start"],
    logPath: path.join(logDir, "backend.log"),
    pidPath: path.join(pidDir, "backend.pid")
  },
  {
    name: "frontend",
    command: "npm",
    args: ["--workspace", "frontend", "run", "start", "--", "-p", env.FRONTEND_PORT ?? "3000"],
    logPath: path.join(logDir, "frontend.log"),
    pidPath: path.join(pidDir, "frontend.pid")
  }
];

switch (action) {
  case "start":
    await start();
    break;
  case "stop":
    stop();
    break;
  case "restart":
    stop();
    await start();
    break;
  case "status":
    status();
    break;
  default:
    console.error("Uso: npm run prod:start | prod:stop | prod:restart | prod:status");
    process.exit(1);
}

async function start() {
  ensureRuntimeDirs();

  const running = services.filter((service) => {
    const pid = readPid(service.pidPath);
    return pid !== null && isRunning(pid);
  });

  if (running.length > 0) {
    console.error(
      `Servico ja em execucao: ${running.map((service) => service.name).join(", ")}.`
    );
    console.error("Use npm run prod:restart para reiniciar.");
    process.exit(1);
  }

  await runForeground("npm", ["run", "build:backend"], "Build backend");
  await runForeground("npm", ["run", "build:frontend"], "Build frontend");

  for (const service of services) {
    startDetached(service);
  }

  console.log("\nAplicacao iniciada em segundo plano.");
  console.log(`Backend:  http://localhost:${env.PORT ?? "3001"}`);
  console.log(`Frontend: http://localhost:${env.FRONTEND_PORT ?? "3000"}`);
  console.log(`Logs:     ${path.relative(rootDir, logDir)}`);
  console.log("Pare com: npm run prod:stop");
}

function stop() {
  ensureRuntimeDirs();

  for (const service of services) {
    const pid = readPid(service.pidPath);

    if (pid === null) {
      console.log(`${service.name}: sem PID registrado.`);
      continue;
    }

    if (!isRunning(pid)) {
      rmSync(service.pidPath, { force: true });
      console.log(`${service.name}: PID antigo removido.`);
      continue;
    }

    try {
      killProcessTree(pid);
      rmSync(service.pidPath, { force: true });
      console.log(`${service.name}: processo ${pid} finalizado.`);
    } catch (error) {
      console.error(
        `${service.name}: falha ao finalizar ${pid}: ${
          error instanceof Error ? error.message : "erro desconhecido"
        }`
      );
    }
  }
}

function status() {
  ensureRuntimeDirs();

  for (const service of services) {
    const pid = readPid(service.pidPath);

    if (pid !== null && isRunning(pid)) {
      console.log(`${service.name}: rodando (pid ${pid})`);
      continue;
    }

    if (pid !== null) {
      console.log(`${service.name}: parado (pid antigo ${pid})`);
      continue;
    }

    console.log(`${service.name}: parado`);
  }
}

function startDetached(service) {
  const logFd = openSync(service.logPath, "a");
  const child = spawn(service.command, service.args, {
    cwd: rootDir,
    detached: true,
    env: {
      ...env,
      NODE_ENV: "production"
    },
    shell: process.platform === "win32",
    stdio: ["ignore", logFd, logFd]
  });

  child.unref();
  closeSync(logFd);
  writeFileSync(service.pidPath, String(child.pid));
  console.log(`${service.name}: iniciado em segundo plano (pid ${child.pid}).`);
}

function runForeground(command, args, label) {
  console.log(`\n==> ${label}`);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env,
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

function ensureRuntimeDirs() {
  mkdirSync(pidDir, { recursive: true });
  mkdirSync(logDir, { recursive: true });
}

function readPid(pidPath) {
  if (!existsSync(pidPath)) {
    return null;
  }

  const pid = Number(readFileSync(pidPath, "utf8").trim());
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killProcessTree(pid) {
  if (process.platform === "win32") {
    process.kill(pid, "SIGTERM");
    return;
  }

  process.kill(-pid, "SIGTERM");
}

function loadEnvFiles() {
  const loadedEnv = { ...process.env };

  for (const filePath of [path.join(rootDir, ".env"), path.join(rootDir, "backend/.env")]) {
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
      loadedEnv[key] = unquote(rawValue);
    }
  }

  return loadedEnv;
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
