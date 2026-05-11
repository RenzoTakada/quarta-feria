import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import { PERSONALITY } from "./personality.js";
import { buildContext } from "./context.js";
import { TOOL_DEFINITIONS, executeTool } from "./tools/index.js";
import { TokenTracker, type TokenSnapshot } from "./tokens.js";

dotenv.config();

const MODEL = "claude-opus-4-7";
const MAX_TOKENS = 16000;

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

export async function chat(
  userMessage: string,
  history: Message[],
  events: AgentEvents,
  tracker: TokenTracker
): Promise<{ response: string; updatedHistory: Message[] }> {
  const context = await buildContext();
  const systemPrompt = PERSONALITY + context;

  const messages: Message[] = [
    ...history,
    { role: "user", content: userMessage },
  ];

  let finalResponse = "";
  let continueLoop = true;

  while (continueLoop) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system: systemPrompt,
      messages,
      tools: TOOL_DEFINITIONS,
    } as Parameters<typeof client.messages.stream>[0]);

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

    // Captura usage + headers para o tracker
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
