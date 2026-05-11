import { config } from "../config.js";

export const EMBED_DIMS = 768;

export async function embed(text: string): Promise<number[]> {
  const res = await fetch(`${config.ollama.url}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.ollama.embedModel, prompt: text }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error(`Ollama: ${res.status} ${res.statusText}`);
  const data = await res.json() as { embedding: number[] };
  return data.embedding;
}

export async function isAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${config.ollama.url}/api/tags`, {
      signal: AbortSignal.timeout(2_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function toSql(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
