import readline from "readline";
import { initSchema } from "../brain/db.js";
import { chat, TokenTracker, type Message } from "./core.js";
import { formatCompact } from "./tokens.js";

const MODEL = "claude-opus-4-7";
const DIM    = "\x1b[2m";
const RESET  = "\x1b[0m";
const CYAN   = "\x1b[36m";
const BOLD   = "\x1b[1m";

const DOTS = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];

function cols(): number { return process.stdout.columns || 80; }
function hr(): string   { return "─".repeat(cols()); }
function kfmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}
function clearLine(): void { process.stdout.write("\r\x1b[2K"); }

function renderPrompt(tracker: TokenTracker): string {
  const snap = tracker.snapshot();
  const status = `${DIM}${formatCompact(snap, MODEL)}${RESET}`;
  return `${status}\n${hr()}\n❯ `;
}

class ThinkingIndicator {
  private timer: NodeJS.Timeout | null = null;
  private dotIdx = 0;
  private startTime = Date.now();
  private thinkingMs = 0;
  private thinkingStart = Date.now();
  private thinkingDone = false;
  private outputTokens = 0;

  start(): void {
    this.startTime = Date.now();
    this.thinkingStart = Date.now();
    this.thinkingDone = false;
    this.outputTokens = 0;
    this.dotIdx = 0;
    this.render();
    this.timer = setInterval(() => this.render(), 100);
  }

  onThinkingDone(): void {
    if (!this.thinkingDone) {
      this.thinkingMs = Date.now() - this.thinkingStart;
      this.thinkingDone = true;
    }
  }

  addOutputTokens(chars: number): void {
    this.outputTokens += chars;
  }

  private render(): void {
    const elapsed = Math.round((Date.now() - this.startTime) / 1000);
    const spinner = DOTS[this.dotIdx % DOTS.length];
    this.dotIdx++;

    const thoughtFor = this.thinkingDone
      ? `thought for ${Math.round(this.thinkingMs / 1000)}s`
      : "thinking…";

    const tokensPart = this.outputTokens > 0
      ? ` · ↓ ${kfmt(this.outputTokens)} chars`
      : "";

    const stats = `${DIM}(${elapsed}s${tokensPart} · ${thoughtFor})${RESET}`;
    clearLine();
    process.stdout.write(`${CYAN}${BOLD}${spinner} Scurrying…${RESET} ${stats}`);
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    clearLine();
  }
}

async function run() {
  await initSchema();
  const tracker = new TokenTracker();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (p: string) => new Promise<string>((resolve) => rl.question(p, resolve));

  console.log(`\n  quarta-feira  ${DIM}ctrl+c para sair${RESET}\n`);

  const history: Message[] = [];

  while (true) {
    const input = await ask(renderPrompt(tracker));
    process.stdout.write(hr() + "\n\n");

    if (!input.trim()) continue;

    const indicator = new ThinkingIndicator();
    indicator.start();

    let responseStarted = false;

    const { updatedHistory } = await chat(input, history, {
      onThinking: () => {},
      onText: (text) => {
        indicator.onThinkingDone();
        indicator.addOutputTokens(text.length);

        if (!responseStarted) {
          indicator.stop();
          process.stdout.write(`${BOLD}quarta-feira:${RESET} `);
          responseStarted = true;
        }
        process.stdout.write(text);
      },
      onToolUse: (name, inp) => {
        indicator.stop();
        process.stdout.write(`\n${DIM}  → ${name}(${JSON.stringify(inp)})${RESET}`);
        indicator.start();
      },
      onToolResult: (_name, result) => {
        indicator.stop();
        const preview = result.length > 80 ? result.slice(0, 80) + "…" : result;
        process.stdout.write(`\n${DIM}  ← ${preview}${RESET}\n`);
        indicator.start();
      },
      onTokenUpdate: () => {},
    }, tracker);

    indicator.stop();
    if (!responseStarted) process.stdout.write(`${BOLD}quarta-feira:${RESET} (sem resposta)`);

    history.length = 0;
    history.push(...updatedHistory);

    process.stdout.write("\n\n");
  }
}

run().catch((err) => {
  console.error("\n✗ Erro:", err.message);
  process.exit(1);
});
