import { TokenTracker } from "../agent/tokens.js";
import type { Message } from "../agent/core.js";
import { config } from "../config.js";

export class Session {
  readonly id: string;
  history: Message[] = [];
  tracker = new TokenTracker();
  busy = false;
  startedAt = Date.now();
  effort: "low" | "medium" | "high" = config.agent.effort;

  constructor(id = "main") {
    this.id = id;
  }

  reset(): void {
    this.history = [];
    this.tracker.reset();
    this.busy = false;
  }
}

// Sessão singleton — único agente
export const session = new Session("main");
