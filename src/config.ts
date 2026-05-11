import fs from "fs";
import path from "path";
import os from "os";
import yaml from "js-yaml";

interface Config {
  agent:   { name: string; model: string; effort: "low" | "medium" | "high" };
  user:    { name: string };
  gateway: { port: number };
  ollama:  { url: string; embedModel: string };
}

const DEFAULTS: Config = {
  agent:   { name: "quarta-feira", model: "claude-opus-4-7", effort: "low" },
  user:    { name: "Renzo" },
  gateway: { port: 18790 },
  ollama:  { url: "http://localhost:11434", embedModel: "nomic-embed-text" },
};

function load(): Config {
  const configPath = path.join(os.homedir(), ".quarta-feria", "config.yaml");
  if (!fs.existsSync(configPath)) return DEFAULTS;

  try {
    const raw = yaml.load(fs.readFileSync(configPath, "utf8")) as Partial<Config>;
    return {
      agent:   { ...DEFAULTS.agent,   ...(raw.agent   ?? {}) },
      user:    { ...DEFAULTS.user,    ...(raw.user    ?? {}) },
      gateway: { ...DEFAULTS.gateway, ...(raw.gateway ?? {}) },
      ollama:  { ...DEFAULTS.ollama,  ...(raw.ollama  ?? {}) },
    };
  } catch {
    return DEFAULTS;
  }
}

export const config = load();
