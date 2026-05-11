import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import { saveEpisode } from "./episodic.js";
import type { Message } from "../agent/core.js";

dotenv.config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function extractText(msg: Message): string {
  if (typeof msg.content === "string") return msg.content;
  if (!Array.isArray(msg.content)) return "";
  return msg.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function buildTranscript(history: Message[]): string {
  return history
    .map((msg) => {
      const role = msg.role === "user" ? "Renzo" : "quarta-feira";
      const text = extractText(msg);
      return text ? `${role}: ${text}` : null;
    })
    .filter(Boolean)
    .join("\n");
}

export async function compressSession(
  history: Message[],
  startedAt: number
): Promise<void> {
  const userMessages = history.filter((m) => m.role === "user");
  if (userMessages.length === 0) return;

  const transcript = buildTranscript(history);
  if (!transcript.trim()) return;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: `Resuma essa conversa em 2-3 frases curtas em português, focando no que foi feito e decidido. Liste até 5 tópicos-chave.

Responda SOMENTE com JSON válido nesse formato:
{"summary": "...", "topics": ["...", "..."]}

Conversa:
${transcript.slice(0, 6000)}`,
      },
    ],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";

  try {
    const parsed = JSON.parse(raw) as { summary: string; topics: string[] };
    await saveEpisode(parsed.summary, parsed.topics, transcript, startedAt);
    process.stderr.write(`[gateway] sessão salva — ${parsed.summary.slice(0, 60)}…\n`);
  } catch {
    await saveEpisode(raw.slice(0, 300), [], transcript, startedAt);
    process.stderr.write(`[gateway] sessão salva (fallback)\n`);
  }
}
