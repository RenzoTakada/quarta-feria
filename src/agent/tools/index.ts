import type Anthropic from "@anthropic-ai/sdk";
import { runBash } from "./bash.js";
import { memorySearch, memorySave } from "./memory.js";

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "bash",
    description: "Executa um comando bash e retorna o output.",
    input_schema: {
      type: "object" as const,
      properties: {
        command: { type: "string", description: "O comando bash a executar." },
      },
      required: ["command"],
    },
  },
  {
    name: "memory_search",
    description: "Busca memórias salvas no cérebro por texto.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "O que buscar na memória." },
      },
      required: ["query"],
    },
  },
  {
    name: "memory_save",
    description: "Salva um fato durável no cérebro.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["user_fact", "project", "preference", "entity"],
          description: "Categoria da memória.",
        },
        key: { type: "string", description: "Nome do fato." },
        value: { type: "string", description: "Valor do fato." },
      },
      required: ["type", "key", "value"],
    },
  },
];

export async function executeTool(
  name: string,
  input: Record<string, string>
): Promise<string> {
  switch (name) {
    case "bash":
      return runBash(input.command);
    case "memory_search":
      return memorySearch(input.query);
    case "memory_save":
      return memorySave(input.type, input.key, input.value);
    default:
      return `[erro]: ferramenta desconhecida "${name}"`;
  }
}
