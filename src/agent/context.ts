import { search } from "../brain/semantic.js";
import { recentEpisodes } from "../brain/episodic.js";
import { topProcedures } from "../brain/procedures.js";

// Injeta no máximo N itens de cada tipo — evita context inflation
const MAX_MEMORIES  = 6;
const MAX_EPISODES  = 3;
const MAX_PROCEDURES = 3;

export async function buildContext(userMessage: string): Promise<string> {
  const [memories, episodes, procedures] = await Promise.all([
    // Busca semântica: retorna só as memórias relevantes para a mensagem atual
    search(userMessage, MAX_MEMORIES),
    recentEpisodes(MAX_EPISODES),
    topProcedures(MAX_PROCEDURES),
  ]);

  const lines: string[] = ["\n\n---\n## O que você já sabe"];

  if (memories.length > 0) {
    lines.push("\n### Memória relevante");
    memories.forEach((m) => lines.push(`- [${m.type}] ${m.key}: ${m.value}`));
  }

  if (episodes.length > 0) {
    lines.push("\n### Sessões anteriores");
    episodes.forEach((e) => {
      const date = new Date(e.ended_at).toLocaleDateString("pt-BR");
      lines.push(`- [${date}] ${e.summary}`);
      if (e.topics.length > 0) lines.push(`  tópicos: ${e.topics.join(", ")}`);
    });
  }

  if (procedures.length > 0) {
    lines.push("\n### Padrões aprendidos");
    procedures.forEach((p) => lines.push(`- quando "${p.trigger}" → ${p.pattern}`));
  }

  if (lines.length === 1) return "";

  return lines.join("\n");
}
