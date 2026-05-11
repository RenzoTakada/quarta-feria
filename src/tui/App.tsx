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
import { Suggestions } from "./components/Suggestions.js";
import { config } from "../config.js";
import { EFFORT_MODEL } from "../agent/core.js";
import { handleCommand, type CommandContext } from "./commands.js";
import { getSuggestions, completionValue } from "./completions.js";

const GATEWAY = `ws://127.0.0.1:${config.gateway.port}`;

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

function resetBusyState(
  setThinking: (v: boolean) => void,
  setThinkingDone: (v: boolean) => void,
  setStreaming: (v: string) => void,
  setOutputChars: (v: number) => void,
  setBusy: (v: boolean) => void,
  streamRef: React.MutableRefObject<string>,
  thinkingEndRef: React.MutableRefObject<boolean>
) {
  streamRef.current = "";
  thinkingEndRef.current = false;
  setStreaming("");
  setThinking(false);
  setThinkingDone(false);
  setOutputChars(0);
  setBusy(false);
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
  const [queueLen, setQueueLen]         = useState(0);
  const [effort, setEffort]             = useState<"low" | "medium" | "high">(config.agent.effort as "low" | "medium" | "high");
  const [selectedIdx, setSelectedIdx]   = useState(0);

  const ws             = useRef<WebSocket | null>(null);
  const msgId          = useRef(0);
  const streamRef      = useRef("");
  const thinkingStart  = useRef(Date.now());
  const thinkingEndRef = useRef(false);
  const busyRef        = useRef(false);
  const pendingQueue   = useRef<string[]>([]);

  // Mantém busyRef sincronizado com busy para acesso em closures
  useEffect(() => { busyRef.current = busy; }, [busy]);

  // Reset seleção ao mudar o input
  useEffect(() => { setSelectedIdx(0); }, [input]);

  const doReset = useCallback(() => {
    resetBusyState(setThinking, setThinkingDone, setStreaming, setOutputChars, setBusy, streamRef, thinkingEndRef);
  }, []);

  useEffect(() => {
    const socket = new WebSocket(GATEWAY);
    ws.current = socket;

    socket.on("open", () => {
      setConnected(true);
      setMessages([{
        id: ++msgId.current,
        role: "assistant",
        content: `Olá, ${config.user.name}. O que vamos fazer hoje?`,
      }]);
    });

    socket.on("close", () => {
      setConnected(false);
      // Se estava ocupado quando a conexão caiu, desbloqueia o UI
      if (busyRef.current) {
        doReset();
        setMessages((prev) => [
          ...prev,
          { id: ++msgId.current, role: "assistant", content: "[conexão perdida — resposta interrompida]" },
        ]);
      }
    });

    socket.on("error", () => {
      setConnected(false);
      if (busyRef.current) doReset();
    });

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
          doReset();
          break;

        case "info":
          setMessages((prev) => [
            ...prev,
            { id: ++msgId.current, role: "assistant", content: msg.message },
          ]);
          break;

        case "error":
          setMessages((prev) => [
            ...prev,
            { id: ++msgId.current, role: "assistant", content: `[erro] ${msg.message}` },
          ]);
          doReset();
          break;
      }
    });

    return () => socket.close();
  }, [doReset]);

  const send = useCallback(
    async (content: string) => {
      if (!content.trim() || busyRef.current || !ws.current) return;

      // Intercepta comandos internos /
      if (content.startsWith("/")) {
        const wsAction = (payload: object) => ws.current?.send(JSON.stringify(payload));
        const cmdCtx: CommandContext = { snap: tokenSnap, model: EFFORT_MODEL[effort], effort };
        const result = await handleCommand(content, wsAction, cmdCtx);
        // Sincroniza effort local se o comando mudou
        const parts = content.trim().split(/\s+/);
        if (parts[0] === "/effort" && ["low", "medium", "high"].includes(parts[1])) {
          setEffort(parts[1] as "low" | "medium" | "high");
        }
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
      busyRef.current = true;
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
    []
  );

  // Quando busy vira false, processa próximo item da fila
  useEffect(() => {
    if (!busy && pendingQueue.current.length > 0) {
      const next = pendingQueue.current.shift()!;
      setQueueLen(pendingQueue.current.length);
      send(next);
    }
  }, [busy, send]);

  useInput((char, key) => {
    if (key.ctrl && char === "c") { exit(); return; }

    const suggestions = getSuggestions(input);

    if (key.upArrow) {
      if (suggestions.length > 0)
        setSelectedIdx((i) => (i > 0 ? i - 1 : suggestions.length - 1));
      return;
    }
    if (key.downArrow) {
      if (suggestions.length > 0)
        setSelectedIdx((i) => (i < suggestions.length - 1 ? i + 1 : 0));
      return;
    }
    if (key.tab) {
      if (suggestions.length > 0) {
        setInput(completionValue(suggestions[selectedIdx]));
      }
      return;
    }
    if (key.escape) {
      setInput("");
      return;
    }

    if (key.return) {
      if (!input.trim()) return;
      // Se há sugestões e o input ainda não é o valor completo, completa em vez de enviar
      if (suggestions.length > 0) {
        const completed = completionValue(suggestions[selectedIdx]);
        if (input.trimEnd() !== completed.trimEnd()) {
          setInput(completed);
          return;
        }
      }
      if (busyRef.current) {
        // Enfileira em vez de descartar
        pendingQueue.current.push(input);
        setQueueLen(pendingQueue.current.length);
        setInput("");
      } else {
        send(input);
        setInput("");
      }
      return;
    }

    if (key.backspace || key.delete) { setInput((p) => p.slice(0, -1)); return; }
    if (!key.ctrl && !key.meta && char) setInput((p) => p + char);
  });

  const rows        = stdout.rows    || 24;
  const cols        = stdout.columns || 80;
  const suggestions = getSuggestions(input);
  // fixedRows: statusbar(1) + inputarea(2) + thinking(1?) + suggestions + paddingTop(1) in Messages
  const fixedRows   = 4 + (thinking ? 1 : 0) + suggestions.length;
  const availRows   = Math.max(2, rows - fixedRows);

  // Conta linhas reais de uma mensagem baseado na largura do terminal
  function msgLines(msg: ChatMessage): number {
    const textLines = msg.content.split("\n").reduce((sum, line) =>
      sum + Math.max(1, Math.ceil((line.length || 1) / Math.max(1, cols - 4))), 0
    );
    return 1 + textLines + 1; // linha do role + conteúdo + marginBottom
  }

  const allMsgs: ChatMessage[] = streaming
    ? [...messages, { id: -1, role: "assistant", content: streaming }]
    : messages;

  // Seleciona da mensagem mais recente para a mais antiga até preencher o espaço
  const visible: ChatMessage[] = [];
  let usedRows = 0;
  for (let i = allMsgs.length - 1; i >= 0; i--) {
    const n = msgLines(allMsgs[i]);
    if (usedRows + n > availRows) break;
    visible.unshift(allMsgs[i]);
    usedRows += n;
  }

  const userHasSpoken = messages.some((m) => m.role === "user");


  return (
    <Box flexDirection="column" height={rows}>
      <StatusBar snap={tokenSnap} model={EFFORT_MODEL[effort]} effort={effort} connected={connected} />
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
      <Suggestions suggestions={suggestions} selectedIdx={selectedIdx} />
      <InputArea value={input} busy={busy} queueLen={queueLen} />
    </Box>
  );
}
