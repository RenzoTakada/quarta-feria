import { pool } from "./db.js";
import { embed, isAvailable, toSql } from "./embeddings.js";
import type { MemoryType, SemanticMemory } from "./types.js";

export async function remember(
  type: MemoryType,
  key: string,
  value: string,
  confidence = 1.0
): Promise<SemanticMemory> {
  const now = Date.now();

  let embeddingSql: string | null = null;
  if (await isAvailable()) {
    try {
      embeddingSql = toSql(await embed(`${key}: ${value}`));
    } catch {
      // sem embedding — continua sem vetor
    }
  }

  const { rows } = await pool.query<SemanticMemory>(
    `INSERT INTO semantic_memory (type, key, value, confidence, embedding, last_used, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $6)
     ON CONFLICT (type, key) DO UPDATE
       SET value      = EXCLUDED.value,
           confidence = EXCLUDED.confidence,
           embedding  = COALESCE(EXCLUDED.embedding, semantic_memory.embedding),
           last_used  = EXCLUDED.last_used
     RETURNING *`,
    [type, key, value, confidence, embeddingSql, now]
  );

  return rows[0];
}

export async function recall(type: MemoryType): Promise<SemanticMemory[]> {
  const now = Date.now();

  const { rows } = await pool.query<SemanticMemory>(
    `UPDATE semantic_memory SET last_used = $1
     WHERE type = $2
     RETURNING *`,
    [now, type]
  );

  return rows.sort((a, b) => b.last_used - a.last_used);
}

export async function search(query: string, limit = 10): Promise<SemanticMemory[]> {
  const seen = new Set<string>();
  const results: SemanticMemory[] = [];

  // Tenta busca vetorial primeiro
  if (await isAvailable()) {
    try {
      const vec = await embed(query);
      const { rows } = await pool.query<SemanticMemory>(
        `SELECT * FROM semantic_memory
         WHERE embedding IS NOT NULL
         ORDER BY embedding <=> $1
         LIMIT $2`,
        [toSql(vec), limit]
      );
      for (const r of rows) {
        seen.add(r.id);
        results.push(r);
      }
    } catch {
      // falha silenciosa — cai no FTS
    }
  }

  // Complementa com full-text para cobrir entradas sem vetor
  const remaining = limit - results.length;
  if (remaining > 0) {
    try {
      const { rows } = await pool.query<SemanticMemory>(
        `SELECT *, ts_rank(to_tsvector('portuguese', key || ' ' || value), plainto_tsquery('portuguese', $1)) AS rank
         FROM semantic_memory
         WHERE to_tsvector('portuguese', key || ' ' || value) @@ plainto_tsquery('portuguese', $1)
         ORDER BY rank DESC
         LIMIT $2`,
        [query, limit]
      );
      for (const r of rows) {
        if (!seen.has(r.id)) results.push(r);
      }
    } catch {
      // tsvector pode falhar com queries vazias
    }
  }

  return results.slice(0, limit);
}

export async function searchByVector(
  embedding: number[],
  limit = 10
): Promise<SemanticMemory[]> {
  const { rows } = await pool.query<SemanticMemory>(
    `SELECT * FROM semantic_memory
     WHERE embedding IS NOT NULL
     ORDER BY embedding <=> $1
     LIMIT $2`,
    [toSql(embedding), limit]
  );

  return rows;
}

export async function forget(type: MemoryType, key: string): Promise<void> {
  await pool.query(
    "DELETE FROM semantic_memory WHERE type = $1 AND key = $2",
    [type, key]
  );
}
