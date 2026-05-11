import type { TokenSnapshot } from "../agent/tokens.js";

// Cliente → Gateway
export type ClientMessage =
  | { type: "chat"; content: string }
  | { type: "reset" }
  | { type: "ping" };

// Gateway → Cliente
export type ServerMessage =
  | { type: "thinking"; text: string }
  | { type: "text"; text: string }
  | { type: "tool_use"; name: string; input: Record<string, string> }
  | { type: "tool_result"; name: string; result: string }
  | { type: "token_update"; snapshot: TokenSnapshot }
  | { type: "done"; response: string }
  | { type: "error"; message: string }
  | { type: "pong" }
  | { type: "ready" };

export function encode(msg: ServerMessage): string {
  return JSON.stringify(msg);
}

export function decode(raw: string): ClientMessage | null {
  try {
    return JSON.parse(raw) as ClientMessage;
  } catch {
    return null;
  }
}
