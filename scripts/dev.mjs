import { spawn } from "node:child_process";

const processes = [];
let shuttingDown = false;

function start(label, args) {
  const child = spawn("npm", args, {
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (code === 0) {
      return;
    }

    const reason = signal ? `signal ${signal}` : `code ${code}`;
    console.error(`Processo ${label} encerrou com ${reason}. Finalizando os demais.`);
    shutdown(code ?? 1);
  });

  processes.push(child);
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of processes) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => process.exit(exitCode), 300);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

start("backend", ["--workspace", "backend", "run", "dev"]);
start("frontend", ["--workspace", "frontend", "run", "dev"]);
