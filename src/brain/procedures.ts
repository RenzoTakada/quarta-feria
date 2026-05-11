import { randomUUID } from "crypto";
import { pool } from "./db.js";
import type { Procedure } from "./types.js";

export async function saveProcedure(trigger: string, pattern: string): Promise<Procedure> {
  const now = Date.now();
  const { rows } = await pool.query<Procedure>(
    `INSERT INTO procedures (id, trigger, pattern, used_count, last_used)
     VALUES ($1, $2, $3, 0, $4)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [randomUUID(), trigger, pattern, now]
  );
  return rows[0];
}

export async function searchProcedures(query: string, limit = 5): Promise<Procedure[]> {
  const { rows } = await pool.query<Procedure>(
    `SELECT * FROM procedures
     WHERE trigger ILIKE $1 OR pattern ILIKE $1
     ORDER BY used_count DESC, last_used DESC
     LIMIT $2`,
    [`%${query}%`, limit]
  );
  return rows;
}

export async function topProcedures(limit = 5): Promise<Procedure[]> {
  const { rows } = await pool.query<Procedure>(
    `SELECT * FROM procedures ORDER BY used_count DESC, last_used DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function incrementUsage(id: string): Promise<void> {
  await pool.query(
    `UPDATE procedures SET used_count = used_count + 1, last_used = $1 WHERE id = $2`,
    [Date.now(), id]
  );
}
