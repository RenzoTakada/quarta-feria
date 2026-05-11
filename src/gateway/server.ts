import { WebSocketServer, WebSocket } from "ws";
import dotenv from "dotenv";
import { initSchema, closePool } from "../brain/db.js";
import { chat } from "../agent/core.js";
import { session } from "./session.js";
import { encode, decode, type ClientMessage } from "./protocol.js";
import { compressSession, compactHistory } from "../brain/compressor.js";

import { config } from "../config.js";

dotenv.config();

const PORT = parseInt(process.env.GATEWAY_PORT ?? String(config.gateway.port), 10);

function send(ws: WebSocket, msg: Parameters<typeof encode>[0]): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(encode(msg));
}

async function handleChat(ws: WebSocket, content: string): Promise<void> {
  if (session.busy) {
    send(ws, { type: "error", message: "Agente ocupado. Aguarde." });
    return;
  }

  session.busy = true;

  try {
    const { updatedHistory } = await chat(
      content,
      session.history,
      {
        onThinking: (text) => send(ws, { type: "thinking", text }),
        onText: (text) => send(ws, { type: "text", text }),
        onToolUse: (name, input) => send(ws, { type: "tool_use", name, input }),
        onToolResult: (name, result) => send(ws, { type: "tool_result", name, result }),
        onTokenUpdate: (snapshot) => send(ws, { type: "token_update", snapshot }),
      },
      session.tracker,
      session.effort
    );

    session.history = updatedHistory;
    const last = [...updatedHistory].reverse().find((m) => m.role === "assistant");
    const response = typeof last?.content === "string"
      ? last.content
      : (last?.content as { type: string; text?: string }[])
          ?.filter((b) => b.type === "text")
          .map((b) => b.text ?? "")
          .join("") ?? "";

    send(ws, { type: "done", response });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    send(ws, { type: "error", message: msg });
  } finally {
    session.busy = false;
  }
}

async function handleCompact(ws: WebSocket): Promise<void> {
  if (session.busy) {
    send(ws, { type: "error", message: "Agente ocupado." });
    return;
  }
  try {
    const { compacted, removedCount } = await compactHistory(session.history);
    if (removedCount === 0) {
      send(ws, { type: "info", message: "Histórico curto demais para compactar (< 4 turns)." });
      return;
    }
    session.history = compacted;
    send(ws, { type: "info", message: `Histórico comprimido — ${removedCount} mensagens resumidas em 2 linhas. Contexto liberado.` });
  } catch (err) {
    send(ws, { type: "error", message: `Falha ao compactar: ${(err as Error).message}` });
  }
}

function handleMessage(ws: WebSocket, msg: ClientMessage): void {
  switch (msg.type) {
    case "chat":
      handleChat(ws, msg.content);
      break;
    case "set_effort":
      session.effort = msg.effort;
      console.log(`[gateway] effort → ${msg.effort}`);
      break;
    case "compact":
      handleCompact(ws);
      break;
    case "reset":
      session.reset();
      send(ws, { type: "ready" });
      break;
    case "ping":
      send(ws, { type: "pong" });
      break;
  }
}

async function start(): Promise<void> {
  await initSchema();

  const wss = new WebSocketServer({ host: "127.0.0.1", port: PORT });

  wss.on("connection", (ws) => {
    console.log("[gateway] cliente conectado");
    send(ws, { type: "ready" });

    ws.on("message", (raw) => {
      const msg = decode(raw.toString());
      if (msg) handleMessage(ws, msg);
    });

    ws.on("close", () => console.log("[gateway] cliente desconectado"));
    ws.on("error", (err) => console.error("[gateway] erro ws:", err.message));
  });

  wss.on("listening", () => {
    console.log(`[gateway] rodando em ws://127.0.0.1:${PORT}`);
    console.log("[gateway] sessão: main | modelo: claude-opus-4-7");
  });

  async function shutdown() {
    process.stderr.write("\n[gateway] comprimindo sessão…\n");
    try {
      await compressSession(session.history, session.startedAt);
    } catch (err) {
      process.stderr.write(`[gateway] erro ao comprimir: ${(err as Error).message}\n`);
    }
    await closePool();
    wss.close(() => process.exit(0));
  }

  process.on("SIGINT",  () => { shutdown(); });
  process.on("SIGTERM", () => { shutdown(); });
}

start().catch((err) => {
  console.error("[gateway] falha ao iniciar:", err.message);
  process.exit(1);
});
