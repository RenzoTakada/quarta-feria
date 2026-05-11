export const CONTEXT_WINDOW = 200_000;

export interface TokenSnapshot {
  contextUsed: number;
  contextLimit: number;
  contextPct: number;
  sessionInputTokens: number;
  sessionOutputTokens: number;
  sessionThinkingTokens: number;
  rateLimitRemaining: number | null;
  rateLimitReset: Date | null;
  resetsIn: string | null;
}

export class TokenTracker {
  private sessionInput = 0;
  private sessionOutput = 0;
  private sessionThinking = 0;
  private lastContextUsed = 0;
  private rateLimitRemaining: number | null = null;
  private rateLimitReset: Date | null = null;

  update(usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  }, headers?: Headers): void {
    this.lastContextUsed = usage.input_tokens;
    this.sessionInput += usage.input_tokens;
    this.sessionOutput += usage.output_tokens;

    if (headers) {
      const remaining = headers.get("anthropic-ratelimit-tokens-remaining");
      const reset = headers.get("anthropic-ratelimit-tokens-reset");
      if (remaining) this.rateLimitRemaining = parseInt(remaining, 10);
      if (reset) this.rateLimitReset = new Date(reset);
    }
  }

  updateThinking(chars: number): void {
    this.sessionThinking += chars;
  }

  snapshot(): TokenSnapshot {
    const contextPct = Math.round((this.lastContextUsed / CONTEXT_WINDOW) * 100);
    const resetsIn = this.rateLimitReset ? formatTimeLeft(this.rateLimitReset) : null;

    return {
      contextUsed: this.lastContextUsed,
      contextLimit: CONTEXT_WINDOW,
      contextPct,
      sessionInputTokens: this.sessionInput,
      sessionOutputTokens: this.sessionOutput,
      sessionThinkingTokens: this.sessionThinking,
      rateLimitRemaining: this.rateLimitRemaining,
      rateLimitReset: this.rateLimitReset,
      resetsIn,
    };
  }

  reset(): void {
    this.sessionInput = 0;
    this.sessionOutput = 0;
    this.sessionThinking = 0;
    this.lastContextUsed = 0;
  }
}

const MODEL_SHORT: Record<string, string> = {
  "claude-haiku-4-5-20251001": "haiku",
  "claude-sonnet-4-6":         "sonnet",
  "claude-opus-4-7":           "opus",
};

export function formatCompact(
  snap: TokenSnapshot,
  model: string,
  effort: "low" | "medium" | "high" = "low"
): string {
  const k = (n: number) => {
    if (n < 1000) return `${n}`;
    const v = n / 1000;
    return v % 1 === 0 ? `${v}k` : `${v.toFixed(1)}k`;
  };
  const shortModel = MODEL_SHORT[model] ?? model;
  const thinkLabel = effort === "high" ? "think on" : "think off";
  const reset = snap.resetsIn && snap.resetsIn !== "agora" ? ` | renova em ${snap.resetsIn}` : "";
  return `${shortModel} | ${thinkLabel} | tokens ${k(snap.contextUsed)}/${k(snap.contextLimit)} (${snap.contextPct}%)${reset}`;
}

function formatTimeLeft(date: Date): string {
  const ms = date.getTime() - Date.now();
  if (ms <= 0) return "agora";
  const totalSecs = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (hrs > 0) return `${hrs}h ${mins}min`;
  if (mins > 0) return `${mins}min ${secs}s`;
  return `${secs}s`;
}
