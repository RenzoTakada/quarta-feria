import { recall, search, forget } from "../brain/semantic.js";
import { recentEpisodes } from "../brain/episodic.js";
import { topProcedures } from "../brain/procedures.js";
import { config } from "../config.js";

export type CommandResult =
  | { type: "output"; text: string }
  | { type: "unknown" }
  | { type: "not_a_command" };

const BLOCKED_PATTERNS = [
  "rm -rf", "git reset --hard", "git clean", "docker volume rm",
  "docker system prune", "cat ~/.ssh", "cat .env", "~/.aws", "~/.gnupg",
  "~/.kube", "sudo", "> /etc", "> /usr", "curl ... | bash", "wget ... | bash",
];

const RISKY_PATTERNS = [
  "rm", "git push --force", "git branch -D", "DROP TABLE",
  "TRUNCATE", "chmod 777", "kill -9", "mkfs",
];

const HELP = `Comandos disponíveis:

  /help                 esta ajuda
  /effort low|medium|high   nível de raciocínio (afeta custo e qualidade)
  /memory               lista todas as memórias
  /memory search <q>    busca memórias por texto
  /memory delete <key>  remove memória por chave
  /memory health        resumo do estado do cérebro
  /sessions             sessões recentes
  /procedures           padrões aprendidos
  /config               configuração atual
  /tools                ferramentas disponíveis
  /safety               regras de segurança bash`;

export type WsAction = (payload: object) => void;

export async function handleCommand(
  input: string,
  wsAction?: WsAction
): Promise<CommandResult> {
  if (!input.startsWith("/")) return { type: "not_a_command" };

  const [cmd, ...args] = input.slice(1).trim().split(/\s+/);
  const arg = args.join(" ");

  switch (cmd) {
    case "help":
      return { type: "output", text: HELP };

    case "effort": {
      const level = args[0] as "low" | "medium" | "high" | undefined;
      if (!level || !["low", "medium", "high"].includes(level)) {
        return { type: "output", text: "Uso: /effort low|medium|high\n\n  low    — resposta direta, pouco raciocínio, menor custo\n  medium — equilíbrio entre qualidade e custo\n  high   — raciocínio extenso, maior qualidade, maior custo" };
      }
      wsAction?.({ type: "set_effort", effort: level });
      const labels = { low: "baixo (econômico)", medium: "médio (equilibrado)", high: "alto (máxima qualidade)" };
      return { type: "output", text: `Raciocínio → ${labels[level]}\nVale para as próximas mensagens desta sessão.` };
    }

    case "memory": {
      if (args[0] === "search" && args[1]) {
        const results = await search(args.slice(1).join(" "), 10);
        if (!results.length) return { type: "output", text: "Nenhuma memória encontrada." };
        return { type: "output", text: results.map((r) => `[${r.type}] ${r.key}: ${r.value}`).join("\n") };
      }
      if (args[0] === "delete" && args[1]) {
        const [type, ...keyParts] = args.slice(1);
        await forget(type as never, keyParts.join(" "));
        return { type: "output", text: `Removido: [${type}] ${keyParts.join(" ")}` };
      }
      if (args[0] === "health") {
        const [facts, prefs, projects] = await Promise.all([
          recall("user_fact"), recall("preference"), recall("project"),
        ]);
        const eps = await recentEpisodes(5);
        const lines = [
          `Memória semântica:`,
          `  user_fact:   ${facts.length} entradas`,
          `  preference:  ${prefs.length} entradas`,
          `  project:     ${projects.length} entradas`,
          ``,
          `Episódios salvos: ${eps.length} recentes`,
          eps.length > 0 ? `  último: ${new Date(eps[0].ended_at).toLocaleDateString("pt-BR")} — ${eps[0].summary.slice(0, 60)}…` : "",
        ].filter(Boolean);
        return { type: "output", text: lines.join("\n") };
      }
      // /memory sem args — lista tudo
      const [facts, prefs, projects, entities] = await Promise.all([
        recall("user_fact"), recall("preference"), recall("project"), recall("entity"),
      ]);
      const all = [...facts, ...prefs, ...projects, ...entities];
      if (!all.length) return { type: "output", text: "Nenhuma memória salva ainda." };
      return { type: "output", text: all.map((r) => `[${r.type}] ${r.key}: ${r.value}`).join("\n") };
    }

    case "sessions": {
      const eps = await recentEpisodes(10);
      if (!eps.length) return { type: "output", text: "Nenhuma sessão salva ainda." };
      return {
        type: "output",
        text: eps.map((e) => {
          const date = new Date(e.ended_at).toLocaleDateString("pt-BR");
          return `[${date}] ${e.summary}\n  tópicos: ${e.topics.join(", ")}`;
        }).join("\n\n"),
      };
    }

    case "procedures": {
      const procs = await topProcedures(20);
      if (!procs.length) return { type: "output", text: "Nenhum padrão aprendido ainda." };
      return {
        type: "output",
        text: procs.map((p) => `quando "${p.trigger}" → ${p.pattern}  (usado ${p.used_count}x)`).join("\n"),
      };
    }

    case "config":
      return {
        type: "output",
        text: [
          `Configuração atual (~/.quarta-feria/config.yaml):`,
          ``,
          `  agent.name:    ${config.agent.name}`,
          `  agent.model:   ${config.agent.model}`,
          `  agent.effort:  ${config.agent.effort}`,
          `  user.name:     ${config.user.name}`,
          `  gateway.port:  ${config.gateway.port}`,
        ].join("\n"),
      };

    case "tools":
      return {
        type: "output",
        text: [
          "Ferramentas disponíveis:",
          "  bash              executa comandos no terminal",
          "  memory_search     busca memórias por texto",
          "  memory_save       salva fato durável",
          "  procedure_search  busca padrões aprendidos",
          "  procedure_save    salva novo padrão",
        ].join("\n"),
      };

    case "safety":
      return {
        type: "output",
        text: [
          "Regras de segurança bash:",
          "",
          "BLOQUEADOS (nunca executam):",
          ...BLOCKED_PATTERNS.map((p) => `  ✗ ${p}`),
          "",
          "ARRISCADOS (exigem confirmação):",
          ...RISKY_PATTERNS.map((p) => `  ⚠ ${p}`),
        ].join("\n"),
      };

    default:
      return { type: "unknown" };
  }
}
