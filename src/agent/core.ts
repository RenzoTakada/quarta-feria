import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import { PERSONALITY } from "./personality.js";
import { buildContext } from "./context.js";
import { TOOL_DEFINITIONS, executeTool } from "./tools/index.js";
import { TokenTracker, type TokenSnapshot } from "./tokens.js";
import { config } from "../config.js";

dotenv.config();

const MAX_TOKENS = 16000;
const MAX_HISTORY_MESSAGES = 20;

// effort → modelo. Haiku é ~60x mais barato que Opus para tarefas cotidianas.
export const EFFORT_MODEL: Record<"low" | "medium" | "high", string> = {
  low:    "claude-haiku-4-5-20251001",
  medium: "claude-sonnet-4-6",
  high:   "claude-opus-4-7",
};

export type AgentEvents = {
  onThinking: (text: string) => void;
  onText: (text: string) => void;
  onToolUse: (name: string, input: Record<string, string>) => void;
  onToolResult: (name: string, result: string) => void;
  onTokenUpdate: (snapshot: TokenSnapshot) => void;
};

export type Message = Anthropic.MessageParam;

export { TokenTracker };
export type { TokenSnapshot };

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function stripThinkingBlocks(messages: Message[]): Message[] {
  return messages.map((m) => {
    if (m.role !== "assistant" || typeof m.content === "string") return m;
    const filtered = (m.content as Anthropic.ContentBlock[]).filter(
      (b) => b.type !== "thinking" && b.type !== "redacted_thinking"
    );
    return { ...m, content: filtered };
  });
}

function trimHistory(messages: Message[]): Message[] {
  if (messages.length <= MAX_HISTORY_MESSAGES) return messages;
  return messages.slice(messages.length - MAX_HISTORY_MESSAGES);
}

export async function chat(
  userMessage: string,
  history: Message[],
  events: AgentEvents,
  tracker: TokenTracker,
  effort: "low" | "medium" | "high" = config.agent.effort
): Promise<{ response: string; updatedHistory: Message[] }> {
  const model = EFFORT_MODEL[effort];
  const context = await buildContext(userMessage);
  const systemPrompt = PERSONALITY + context;
  const cleanHistory = trimHistory(stripThinkingBlocks(history));

  const messages: Message[] = [
    ...cleanHistory,
    { role: "user", content: userMessage },
  ];

  let finalResponse = "";
  let continueLoop = true;

  while (continueLoop) {
    // Thinking só está disponível no Opus (effort "high")
    const streamParams = effort === "high"
      ? {
          model, max_tokens: MAX_TOKENS,
          thinking: { type: "adaptive" },
          output_config: { effort: "high" },
          system: systemPrompt, messages, tools: TOOL_DEFINITIONS,
        }
      : {
          model, max_tokens: MAX_TOKENS,
          system: systemPrompt, messages, tools: TOOL_DEFINITIONS,
        };

    const stream = client.messages.stream(
      streamParams as Parameters<typeof client.messages.stream>[0]
    );

    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        if (event.delta.type === "thinking_delta") {
          events.onThinking(event.delta.thinking);
          tracker.updateThinking(event.delta.thinking.length);
        } else if (event.delta.type === "text_delta") {
          events.onText(event.delta.text);
          finalResponse += event.delta.text;
        }
      }
    }

    const message = await stream.finalMessage();
    const httpResponse = stream.response as Response | undefined;
    tracker.update(message.usage, httpResponse?.headers as unknown as Headers);
    events.onTokenUpdate(tracker.snapshot());

    messages.push({ role: "assistant", content: message.content });

    if (message.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of message.content) {
        if (block.type !== "tool_use") continue;

        const input = block.input as Record<string, string>;
        events.onToolUse(block.name, input);

        const result = await executeTool(block.name, input);
        events.onToolResult(block.name, result);

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }

      messages.push({ role: "user", content: toolResults });
      finalResponse = "";
    } else {
      continueLoop = false;
    }
  }

  return { response: finalResponse, updatedHistory: messages };
}
