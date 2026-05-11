import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, useInput, useApp, useStdout } from "ink";
import WebSocket from "ws";
import type { ServerMessage } from "../gateway/protocol.js";
import type { TokenSnapshot } from "../agent/tokens.js";
import { StatusBar } from "./components/StatusBar.js";
import { Banner } from "./components/Banner.js";
import { Messages } from "./components/Messages.js";
import { ThinkingIndicator } from "./components/Thinking.js";
import { InputArea } from "./components/InputArea.js";
import { config } from "../config.js";
import { handleCommand } from "./commands.js";

const GATEWAY = `ws://127.0.0.1:${config.gateway.port}`;
const MODEL   = config.agent.model;

const DEFAULT_SNAP: TokenSnapshot = {
  contextUsed: 0, contextLimit: 200_000, contextPct: 0,
  sessionInputTokens: 0, sessionOutputTokens: 0, sessionThinkingTokens: 0,
  rateLimitRemaining: null, rateLimitReset: null, resetsIn: null,
};

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
}

export default function App() {
  const { exit }   = useApp();
  const { stdout } = useStdout();

  const [messages, setMessages]         = useState<ChatMessage[]>([]);
  const [streaming, setStreaming]       = useState("");
  const [input, setInput]               = useState("");
  const [busy, setBusy]                 = useState(false);
  const [connected, setConnected]       = useState(false);
  const [thinking, setThinking]         = useState(false);
  const [thinkingDone, setThinkingDone] = useState(false);
  const [thinkingMs, setThinkingMs]     = useState(0);
  const [startTime, setStartTime]       = useState(Date.now());
  const [outputChars, setOutputChars]   = useState(0);
  const [tokenSnap, setTokenSnap]       = useState<TokenSnapshot>(DEFAULT_SNAP);

  const ws             = useRef<WebSocket | null>(null);
  const msgId          = useRef(0);
  const streamRef      = useRef("");
  const thinkingStart  = useRef(Date.now());
  const thinkingEndRef = useRef(false);

  useEffect(() => {
    const socket = new WebSocket(GATEWAY);
    ws.current = socket;

    socket.on("open",  () => {
      setConnected(true);
      setMessages([{
        id: ++msgId.current,
        role: "assistant",
        content: `Olá, ${config.user.name}. O que vamos fazer hoje?`,
      }]);
    });
    socket.on("close", () => setConnected(false));
    socket.on("error", () => setConnected(false));

    socket.on("message", (raw: Buffer) => {
      const msg = JSON.parse(raw.toString()) as ServerMessage;

      switch (msg.type) {
        case "ready":
          setConnected(true);
          break;

        case "thinking":
          setThinking(true);
          break;

        case "text":
          if (!thinkingEndRef.current) {
            thinkingEndRef.current = true;
            setThinkingDone(true);
            setThinkingMs(Date.now() - thinkingStart.current);
          }
          streamRef.current += msg.text;
          setStreaming(streamRef.current);
          setOutputChars((n) => n + msg.text.length);
          break;

        case "token_update":
          setTokenSnap(msg.snapshot);
          break;

        case "done":
          setMessages((prev) => [
            ...prev,
            { id: ++msgId.current, role: "assistant", content: msg.response },
          ]);
          streamRef.current = "";
          setStreaming("");
          setThinking(false);
          setThinkingDone(false);
          thinkingEndRef.current = false;
          setOutputChars(0);
          setBusy(false);
          break;

        case "error":
          setMessages((prev) => [
            ...prev,
            { id: ++msgId.current, role: "assistant", content: `[erro] ${msg.message}` },
          ]);
          streamRef.current = "";
          setStreaming("");
          setThinking(false);
          setBusy(false);
          break;
      }
    });

    return () => socket.close();
  }, []);

  const send = useCallback(
    async (content: string) => {
      if (!content.trim() || busy || !ws.current) return;

      // Intercepta comandos internos /
      if (content.startsWith("/")) {
        const result = await handleCommand(content);
        if (result.type === "output") {
          setMessages((prev) => [...prev,
            { id: ++msgId.current, role: "user", content },
            { id: ++msgId.current, role: "assistant", content: result.text },
          ]);
          return;
        }
        if (result.type === "unknown") {
          setMessages((prev) => [...prev,
            { id: ++msgId.current, role: "assistant", content: `Comando desconhecido: "${content}"\nDigite /help para ver os disponíveis.` },
          ]);
          return;
        }
      }

      setMessages((prev) => [...prev, { id: ++msgId.current, role: "user", content }]);
      setBusy(true);
      setThinking(true);
      setThinkingDone(false);
      thinkingEndRef.current = false;
      setStreaming("");
      setOutputChars(0);
      const now = Date.now();
      setStartTime(now);
      thinkingStart.current = now;
      ws.current.send(JSON.stringify({ type: "chat", content }));
    },
    [busy]
  );

  useInput((char, key) => {
    if (key.ctrl && char === "c") { exit(); return; }
    if (key.return)               { send(input); setInput(""); return; }
    if (key.backspace || key.delete) { setInput((p) => p.slice(0, -1)); return; }
    if (!key.ctrl && !key.meta && char) setInput((p) => p + char);
  });

  // Calcula quantas mensagens cabem na tela
  const rows      = stdout.rows || 24;
  const fixedRows = 3 + (thinking ? 1 : 0); // statusbar + inputarea + thinking
  const msgSlots  = Math.max(1, Math.floor((rows - fixedRows) / 3));

  const displayMsgs: ChatMessage[] = streaming
    ? [...messages, { id: -1, role: "assistant", content: streaming }]
    : messages;

  const visible = displayMsgs.slice(-msgSlots);

  const userHasSpoken = messages.some((m) => m.role === "user");

  return (
    <Box flexDirection="column" height={rows}>
      <StatusBar snap={tokenSnap} model={MODEL} connected={connected} />
      {!userHasSpoken && <Banner />}
      <Messages messages={visible} />
      {thinking && (
        <ThinkingIndicator
          startTime={startTime}
          thinkingDone={thinkingDone}
          thinkingMs={thinkingMs}
          outputChars={outputChars}
        />
      )}
      <InputArea value={input} busy={busy} />
    </Box>
  );
}
