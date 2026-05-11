import { initSchema, closePool } from "./db.js";
import { remember, recall, search } from "./semantic.js";
import { saveEpisode, recentEpisodes } from "./episodic.js";
import { embed, isAvailable } from "./embeddings.js";

async function run() {
  console.log("→ Conectando ao PostgreSQL...");
  await initSchema();
  console.log("✓ Schema criado — extensões uuid-ossp + pgvector ativas\n");

  console.log("→ Verificando Ollama...");
  const ollamaOk = await isAvailable();
  console.log(ollamaOk ? "✓ Ollama disponível — embeddings ativos" : "⚠ Ollama indisponível — modo texto apenas");

  if (ollamaOk) {
    const vec = await embed("teste de embedding");
    console.log(`✓ Embedding gerado: ${vec.length} dims, primeiro valor: ${vec[0].toFixed(6)}\n`);
  } else {
    console.log();
  }

  console.log("→ Salvando memórias semânticas (com embedding se disponível)...");
  await remember("user_fact", "nome", "Renzo Takada");
  await remember("user_fact", "idioma", "português brasileiro");
  await remember("preference", "estilo_resposta", "direto, sem enrolação");
  await remember("project", "quarta-feria", "assistente AI local, Claude + PostgreSQL + TUI");
  console.log("✓ Memórias salvas\n");

  console.log("→ Recuperando fatos do usuário:");
  const facts = await recall("user_fact");
  facts.forEach((f) => console.log(`  ${f.key}: ${f.value}`));

  console.log("\n→ Busca semântica por 'assistente inteligente':");
  const results = await search("assistente inteligente");
  if (results.length) {
    results.forEach((r) => console.log(`  [${r.type}] ${r.key}: ${r.value}`));
  } else {
    console.log("  (nenhum resultado)");
  }

  console.log("\n→ Busca por 'direto' (full-text fallback):");
  const fts = await search("direto");
  if (fts.length) {
    fts.forEach((r) => console.log(`  [${r.type}] ${r.key}: ${r.value}`));
  } else {
    console.log("  (nenhum resultado)");
  }

  console.log("\n→ Salvando episódio de sessão...");
  const ep = await saveEpisode(
    "Primeira sessão: definição da arquitetura do projeto quarta-feria",
    ["arquitetura", "brain.db", "PostgreSQL", "pgvector", "Claude"],
    "renzo: quero criar um assistente... quarta-feria: aqui está a arquitetura...",
    Date.now() - 60000
  );
  console.log(`✓ Episódio salvo: ${ep.id}`);
  console.log(`  embedding: ${ep.embedding ? "✓ vetor armazenado" : "✗ sem vetor"}\n`);

  console.log("→ Episódios recentes:");
  const episodes = await recentEpisodes(3);
  episodes.forEach((e) =>
    console.log(`  [${new Date(e.ended_at).toLocaleString()}] ${e.summary}`)
  );

  await closePool();
  console.log("\n✓ Pipeline completo — PostgreSQL + pgvector + Ollama embeddings funcionando.");
}

run().catch((err) => {
  console.error("✗ Erro:", err.message);
  process.exit(1);
});
