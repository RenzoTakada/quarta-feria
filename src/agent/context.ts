import { recall } from "../brain/semantic.js";
import { recentEpisodes } from "../brain/episodic.js";

export async function buildContext(): Promise<string> {
  const [userFacts, preferences, projects, episodes] = await Promise.all([
    recall("user_fact"),
    recall("preference"),
    recall("project"),
    recentEpisodes(5),
  ]);

  const lines: string[] = ["\n\n---\n## O que você já sabe"];

  if (userFacts.length > 0) {
    lines.push("\n### Usuário");
    userFacts.forEach((f) => lines.push(`- ${f.key}: ${f.value}`));
  }

  if (preferences.length > 0) {
    lines.push("\n### Preferências");
    preferences.forEach((p) => lines.push(`- ${p.key}: ${p.value}`));
  }

  if (projects.length > 0) {
    lines.push("\n### Projetos");
    projects.forEach((p) => lines.push(`- ${p.key}: ${p.value}`));
  }

  if (episodes.length > 0) {
    lines.push("\n### Sessões anteriores");
    episodes.forEach((e) => {
      const date = new Date(e.ended_at).toLocaleDateString("pt-BR");
      lines.push(`- [${date}] ${e.summary}`);
      if (e.topics.length > 0) lines.push(`  tópicos: ${e.topics.join(", ")}`);
    });
  }

  if (lines.length === 1) return "";

  return lines.join("\n");
}
