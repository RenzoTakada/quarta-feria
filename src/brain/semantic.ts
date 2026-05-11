import { pool } from "./db.js";
import type { MemoryType, SemanticMemory } from "./types.js";

export async function remember(
  type: MemoryType,
  key: string,
  value: string,
  confidence = 1.0
): Promise<SemanticMemory> {
  const now = Date.now();

  const { rows } = await pool.query<SemanticMemory>(
    `INSERT INTO semantic_memory (type, key, value, confidence, last_used, created_at)
     VALUES ($1, $2, $3, $4, $5, $5)
     ON CONFLICT (type, key) DO UPDATE
       SET value = EXCLUDED.value,
           confidence = EXCLUDED.confidence,
           last_used = EXCLUDED.last_used
     RETURNING *`,
    [type, key, value, confidence, now]
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
  const { rows } = await pool.query<SemanticMemory>(
    `SELECT *, ts_rank(to_tsvector('portuguese', key || ' ' || value), plainto_tsquery('portuguese', $1)) AS rank
     FROM semantic_memory
     WHERE to_tsvector('portuguese', key || ' ' || value) @@ plainto_tsquery('portuguese', $1)
     ORDER BY rank DESC
     LIMIT $2`,
    [query, limit]
  );

  return rows;
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
    [`[${embedding.join(",")}]`, limit]
  );

  return rows;
}

export async function forget(type: MemoryType, key: string): Promise<void> {
  await pool.query(
    "DELETE FROM semantic_memory WHERE type = $1 AND key = $2",
    [type, key]
  );
}
