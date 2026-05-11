import { exec } from "child_process";
import { promisify } from "util";
import { checkSafety, formatBlocked, formatConfirmation } from "./safety.js";

const execAsync = promisify(exec);
const TIMEOUT_MS = 30_000;

// Confirmações pendentes: hash do comando → timestamp
const pending = new Map<string, number>();
const CONFIRM_TTL = 5 * 60 * 1000; // 5 minutos

function hashCmd(cmd: string): string {
  return cmd.trim().toLowerCase();
}

function isConfirmationExpired(ts: number): boolean {
  return Date.now() - ts > CONFIRM_TTL;
}

export async function runBash(command: string, confirmed = false): Promise<string> {
  const safety = checkSafety(command);

  if (safety.status === "blocked") {
    return formatBlocked(command, safety.reason);
  }

  if (safety.status === "needs_confirmation") {
    const key = hashCmd(command);
    const ts = pending.get(key);

    const alreadyConfirmed = confirmed || (ts !== undefined && !isConfirmationExpired(ts));

    if (!alreadyConfirmed) {
      pending.set(key, Date.now());
      return formatConfirmation(command, safety.reason);
    }

    pending.delete(key);
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: TIMEOUT_MS,
      shell: "/bin/zsh",
    });
    const out = stdout.trim();
    const err = stderr.trim();
    if (out && err) return `${out}\n[stderr]: ${err}`;
    return out || err || "(sem output)";
  } catch (e: unknown) {
    const err = e as { stderr?: string; message?: string };
    return `[erro]: ${err.stderr?.trim() || err.message || String(e)}`;
  }
}

export function confirmPending(command: string): void {
  const key = hashCmd(command);
  pending.set(key, Date.now());
}
