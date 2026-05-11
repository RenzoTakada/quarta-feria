export type SafetyResult =
  | { status: "allowed" }
  | { status: "blocked"; reason: string }
  | { status: "needs_confirmation"; reason: string };

const BLOCKED: { pattern: RegExp; reason: string }[] = [
  { pattern: /rm\s+-rf/i,                          reason: "apaga arquivos irreversivelmente" },
  { pattern: /git\s+reset\s+--hard/i,              reason: "descarta mudanças sem recuperação" },
  { pattern: /git\s+clean/i,                       reason: "apaga arquivos não rastreados" },
  { pattern: /docker\s+volume\s+rm/i,              reason: "destrói volume Docker com dados" },
  { pattern: /docker\s+system\s+prune/i,           reason: "apaga todos os recursos Docker não usados" },
  { pattern: /cat\s+.*\.env/i,                     reason: "expõe variáveis de ambiente e secrets" },
  { pattern: /cat\s+~\/\.ssh/i,                    reason: "acessa chaves SSH privadas" },
  { pattern: /~\/\.(aws|gnupg|kube)[^\w]/i,        reason: "acessa credenciais sensíveis" },
  { pattern: /\bsudo\b/,                           reason: "executa com privilégios elevados" },
  { pattern: />\s*(\/etc|\/usr|\/bin|\/sbin)/i,    reason: "sobrescreve diretório de sistema" },
  { pattern: /curl.*(sh|bash)\s*\|/i,              reason: "executa script remoto sem inspeção" },
  { pattern: /wget.*(sh|bash)\s*\|/i,              reason: "executa script remoto sem inspeção" },
];

const RISKY: { pattern: RegExp; reason: string }[] = [
  { pattern: /\brm\b/,                             reason: "apaga arquivos" },
  { pattern: /git\s+push\s+--force/i,              reason: "sobrescreve histórico remoto" },
  { pattern: /git\s+branch\s+-D/i,                reason: "apaga branch permanentemente" },
  { pattern: /\bdrop\s+(table|database)/i,         reason: "destrói dados de banco" },
  { pattern: /\btruncate\b/i,                      reason: "apaga todos os registros de uma tabela" },
  { pattern: /\bchmod\s+777\b/,                    reason: "abre permissões inseguras" },
  { pattern: /\bkill\b.*-9/,                       reason: "força encerramento de processo" },
  { pattern: /\bmkfs\b/,                           reason: "formata dispositivo de armazenamento" },
];

export function checkSafety(command: string): SafetyResult {
  for (const rule of BLOCKED) {
    if (rule.pattern.test(command)) {
      return { status: "blocked", reason: rule.reason };
    }
  }
  for (const rule of RISKY) {
    if (rule.pattern.test(command)) {
      return { status: "needs_confirmation", reason: rule.reason };
    }
  }
  return { status: "allowed" };
}

export function formatBlocked(command: string, reason: string): string {
  return `[bloqueado] Comando não permitido: "${command}"\nMotivo: ${reason}`;
}

export function formatConfirmation(command: string, reason: string): string {
  return [
    `⚠️  Este comando exige confirmação explícita:`,
    ``,
    `  ${command}`,
    ``,
    `Motivo: ${reason}`,
    ``,
    `Para executar, responda exatamente: confirmar execução`,
  ].join("\n");
}
