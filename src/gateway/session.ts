import { TokenTracker } from "../agent/tokens.js";
import type { Message } from "../agent/core.js";

export class Session {
  readonly id: string;
  history: Message[] = [];
  tracker = new TokenTracker();
  busy = false;
  startedAt = Date.now();

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
