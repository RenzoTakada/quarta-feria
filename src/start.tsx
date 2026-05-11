import React from "react";
import { render } from "ink";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import App from "./tui/App.js";

const ROOT = path.resolve(path.dirname(""));
const LOG_DIR  = path.join(os.homedir(), ".quarta-feria");
const LOG_PATH = path.join(LOG_DIR, "gateway.log");

fs.mkdirSync(LOG_DIR, { recursive: true });
const logFd = fs.openSync(LOG_PATH, "a");

const gateway = spawn(
  "npx", ["tsx", path.join(ROOT, "src", "gateway", "server.ts")],
  { stdio: ["ignore", logFd, logFd], cwd: ROOT, detached: false }
);

gateway.on("error", (err) => {
  // Porta já ocupada — TUI conecta no gateway existente
  if ((err as NodeJS.ErrnoException).code !== "EADDRINUSE") {
    process.stderr.write(`[gateway] ${err.message}\n`);
  }
});

// Pequena espera para o gateway subir antes do TUI conectar
setTimeout(() => {
  const { waitUntilExit } = render(<App />);

  waitUntilExit().then(() => {
    gateway.kill();
    fs.closeSync(logFd);
    process.exit(0);
  });
}, 800);
