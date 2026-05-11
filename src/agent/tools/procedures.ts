import { saveProcedure, searchProcedures } from "../../brain/procedures.js";

export async function procedureSearch(query: string): Promise<string> {
  const results = await searchProcedures(query, 5);
  if (results.length === 0) return "Nenhum padrão encontrado.";
  return results.map((p) => `gatilho: ${p.trigger}\npadrão: ${p.pattern}`).join("\n---\n");
}

export async function procedureSave(trigger: string, pattern: string): Promise<string> {
  await saveProcedure(trigger, pattern);
  return `Padrão salvo: quando "${trigger}" → "${pattern}"`;
}
