export type MemoryType = "user_fact" | "project" | "preference" | "entity";

export interface SemanticMemory {
  id: string;
  type: MemoryType;
  key: string;
  value: string;
  confidence: number;
  last_used: number;
  created_at: number;
}

export interface Episode {
  id: string;
  summary: string;
  topics: string[];
  transcript: string;
  embedding: string | null;
  started_at: number;
  ended_at: number;
}

export interface Procedure {
  id: string;
  trigger: string;
  pattern: string;
  used_count: number;
  last_used: number;
}

export interface WorkingMemory {
  session_id: string;
  context: Record<string, unknown>;
  updated_at: number;
}

export interface ToolCache {
  query_hash: string;
  tool: string;
  result: string;
  expires_at: number;
}
