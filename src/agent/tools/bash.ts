import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const TIMEOUT_MS = 30_000;

export async function runBash(command: string): Promise<string> {
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
