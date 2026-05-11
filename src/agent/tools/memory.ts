import { remember, search } from "../../brain/semantic.js";
import type { MemoryType } from "../../brain/types.js";

export async function memorySearch(query: string): Promise<string> {
  const results = await search(query, 5);
  if (results.length === 0) return "Nenhuma memória encontrada para essa busca.";
  return results
    .map((r) => `[${r.type}] ${r.key}: ${r.value}`)
    .join("\n");
}

export async function memorySave(
  type: string,
  key: string,
  value: string
): Promise<string> {
  await remember(type as MemoryType, key, value);
  return `Salvo: [${type}] ${key}: ${value}`;
}
