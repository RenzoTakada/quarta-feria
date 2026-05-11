import { Pool, types } from "pg";
import dotenv from "dotenv";

dotenv.config();

// pg retorna BIGINT como string por padrão — converte para number
types.setTypeParser(20, (val) => parseInt(val, 10));

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgresql://quarta:feria@localhost:5432/quarta_feria",
});

export async function initSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await client.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS semantic_memory (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        type        TEXT NOT NULL,
        key         TEXT NOT NULL,
        value       TEXT NOT NULL,
        confidence  REAL DEFAULT 1.0,
        embedding   vector(1536),
        last_used   BIGINT NOT NULL,
        created_at  BIGINT NOT NULL,
        UNIQUE (type, key)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS semantic_memory_fts
      ON semantic_memory
      USING GIN (to_tsvector('portuguese', key || ' ' || value))
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS semantic_memory_vec
      ON semantic_memory
      USING hnsw (embedding vector_cosine_ops)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS episodes (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        summary     TEXT NOT NULL,
        topics      TEXT[] NOT NULL DEFAULT '{}',
        transcript  TEXT NOT NULL DEFAULT '',
        embedding   vector(1536),
        started_at  BIGINT NOT NULL,
        ended_at    BIGINT NOT NULL
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS episodes_ended_idx
      ON episodes (ended_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS episodes_vec
      ON episodes
      USING hnsw (embedding vector_cosine_ops)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS procedures (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        trigger     TEXT NOT NULL,
        pattern     TEXT NOT NULL,
        used_count  INTEGER DEFAULT 0,
        last_used   BIGINT NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS working_memory (
        session_id  TEXT PRIMARY KEY,
        context     JSONB NOT NULL DEFAULT '{}',
        updated_at  BIGINT NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tool_cache (
        query_hash  TEXT PRIMARY KEY,
        tool        TEXT NOT NULL,
        result      TEXT NOT NULL,
        expires_at  BIGINT NOT NULL
      )
    `);
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
