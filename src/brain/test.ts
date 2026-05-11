import { initSchema, closePool } from "./db.js";
import { remember, recall, search } from "./semantic.js";
import { saveEpisode, recentEpisodes } from "./episodic.js";

async function run() {
  console.log("→ Conectando ao PostgreSQL...");
  await initSchema();
  console.log("✓ Schema criado — extensões uuid-ossp + pgvector ativas\n");

  console.log("→ Salvando memórias semânticas...");
  await remember("user_fact", "nome", "Renzo Takada");
  await remember("user_fact", "idioma", "português brasileiro");
  await remember("preference", "estilo_resposta", "direto, sem enrolação");
  await remember("project", "quarta-feria", "assistente AI local, Claude + PostgreSQL + TUI");
  console.log("✓ Memórias salvas\n");

  console.log("→ Recuperando fatos do usuário:");
  const facts = await recall("user_fact");
  facts.forEach((f) => console.log(`  ${f.key}: ${f.value}`));

  console.log("\n→ Busca full-text por 'direto':");
  const results = await search("direto");
  results.forEach((r) => console.log(`  [${r.type}] ${r.key}: ${r.value}`));

  console.log("\n→ Salvando episódio de sessão...");
  const ep = await saveEpisode(
    "Primeira sessão: definição da arquitetura do projeto quarta-feria",
    ["arquitetura", "brain.db", "PostgreSQL", "pgvector", "Claude"],
    "renzo: quero criar um assistente... quarta-feria: aqui está a arquitetura...",
    Date.now() - 60000
  );
  console.log(`✓ Episódio salvo: ${ep.id}\n`);

  console.log("→ Episódios recentes:");
  const episodes = await recentEpisodes(3);
  episodes.forEach((e) =>
    console.log(`  [${new Date(e.ended_at).toLocaleString()}] ${e.summary}`)
  );

  await closePool();
  console.log("\n✓ Bloco 1 completo — cérebro PostgreSQL + pgvector funcionando.");
}

run().catch((err) => {
  console.error("✗ Erro:", err.message);
  process.exit(1);
});
