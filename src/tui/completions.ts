export type Completion = {
  value: string;
  label: string;
  hint: string;
};

const TOP: Completion[] = [
  { value: "/help",       label: "/help",       hint: "lista todos os comandos" },
  { value: "/effort",     label: "/effort",     hint: "troca o modelo (low · medium · high)" },
  { value: "/compact",    label: "/compact",    hint: "comprime histórico com haiku (libera contexto)" },
  { value: "/memory",     label: "/memory",     hint: "gerencia memórias persistentes" },
  { value: "/sessions",   label: "/sessions",   hint: "sessões recentes" },
  { value: "/procedures", label: "/procedures", hint: "padrões aprendidos" },
  { value: "/config",     label: "/config",     hint: "configuração atual" },
  { value: "/tools",      label: "/tools",      hint: "ferramentas disponíveis" },
  { value: "/safety",     label: "/safety",     hint: "regras de segurança bash" },
];

const SUB: Record<string, Completion[]> = {
  "/effort ": [
    { value: "/effort low",    label: "low",    hint: "haiku   · rápido, econômico, sem thinking" },
    { value: "/effort medium", label: "medium", hint: "sonnet  · equilibrado" },
    { value: "/effort high",   label: "high",   hint: "opus    · raciocínio estendido, maior custo" },
  ],
  "/memory ": [
    { value: "/memory search ",  label: "search <q>",            hint: "busca memórias por texto" },
    { value: "/memory delete ",  label: "delete <tipo> <chave>", hint: "remove memória por chave" },
    { value: "/memory health",   label: "health",                hint: "resumo do estado do cérebro" },
  ],
};

// Comandos que têm subcomandos — Tab completa com espaço automático
const HAS_SUB = new Set(Object.keys(SUB).map((k) => k.trimEnd()));

export function getSuggestions(input: string): Completion[] {
  if (!input.startsWith("/")) return [];

  // Contexto de subcomando (match mais longo primeiro)
  for (const prefix of Object.keys(SUB).sort((a, b) => b.length - a.length)) {
    if (input.startsWith(prefix)) {
      const rest = input.slice(prefix.length).toLowerCase();
      return SUB[prefix].filter((c) => c.label.toLowerCase().startsWith(rest));
    }
  }

  // Top-level: filtra pelo que foi digitado após /
  if (input === "/") return TOP;
  const q = input.slice(1).toLowerCase();
  return TOP.filter((c) => c.label.slice(1).startsWith(q));
}

export function completionValue(c: Completion): string {
  // Se o comando tem subcomandos, Tab adiciona espaço para revelar o próximo nível
  return HAS_SUB.has(c.value) ? c.value + " " : c.value;
}
