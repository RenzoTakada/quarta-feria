import React from "react";
import { render } from "ink";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import App from "./tui/App.js";

// start.tsx está em src/ — ROOT é um nível acima
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LOG_DIR  = path.join(os.homedir(), ".quarta-feria");
const LOG_PATH = path.join(LOG_DIR, "gateway.log");

fs.mkdirSync(LOG_DIR, { recursive: true });
const logFd = fs.openSync(LOG_PATH, "a");

const gateway = spawn(
  "npx", ["tsx", path.join(ROOT, "src", "gateway", "server.ts")],
  { stdio: ["ignore", logFd, logFd], cwd: ROOT, detached: false }
);

gateway.on("error", (err) => {
  if ((err as NodeJS.ErrnoException).code !== "EADDRINUSE") {
    process.stderr.write(`[gateway] ${err.message}\n`);
  }
});

let cleanedUp = false;
function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  gateway.kill();
  try { fs.closeSync(logFd); } catch {}
}

process.on("SIGINT",  () => { cleanup(); process.exit(0); });
process.on("SIGTERM", () => { cleanup(); process.exit(0); });
process.on("exit",    cleanup);

setTimeout(() => {
  const { waitUntilExit } = render(<App />);

  waitUntilExit().then(() => {
    cleanup();
    process.exit(0);
  });
}, 800);
