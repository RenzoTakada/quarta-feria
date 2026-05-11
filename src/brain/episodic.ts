import { pool } from "./db.js";
import type { Episode } from "./types.js";

export async function saveEpisode(
  summary: string,
  topics: string[],
  transcript: string,
  started_at: number
): Promise<Episode> {
  const ended_at = Date.now();

  const { rows } = await pool.query<Episode>(
    `INSERT INTO episodes (summary, topics, transcript, started_at, ended_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [summary, topics, transcript, started_at, ended_at]
  );

  return rows[0];
}

export async function recentEpisodes(limit = 5): Promise<Episode[]> {
  const { rows } = await pool.query<Episode>(
    `SELECT * FROM episodes ORDER BY ended_at DESC LIMIT $1`,
    [limit]
  );

  return rows;
}

export async function searchEpisodes(query: string, limit = 5): Promise<Episode[]> {
  const { rows } = await pool.query<Episode>(
    `SELECT * FROM episodes
     WHERE summary ILIKE $1 OR $2 = ANY(topics)
     ORDER BY ended_at DESC
     LIMIT $3`,
    [`%${query}%`, query, limit]
  );

  return rows;
}

export async function searchEpisodesByVector(
  embedding: number[],
  limit = 5
): Promise<Episode[]> {
  const { rows } = await pool.query<Episode>(
    `SELECT * FROM episodes
     WHERE embedding IS NOT NULL
     ORDER BY embedding <=> $1
     LIMIT $2`,
    [`[${embedding.join(",")}]`, limit]
  );

  return rows;
}
