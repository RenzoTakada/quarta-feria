export type Completion = {
  value: string;
  label: string;
  hint: string;
};

const TOP: Completion[] = [
  { value: "/help",       label: "/help",       hint: "list all commands" },
  { value: "/status",     label: "/status",     hint: "session tokens and estimated cost" },
  { value: "/effort",     label: "/effort",     hint: "switch model (low · medium · high)" },
  { value: "/compact",    label: "/compact",    hint: "compress history with haiku (free context)" },
  { value: "/memory",     label: "/memory",     hint: "manage persistent memories" },
  { value: "/sessions",   label: "/sessions",   hint: "recent sessions" },
  { value: "/procedures", label: "/procedures", hint: "learned patterns" },
  { value: "/config",     label: "/config",     hint: "current configuration" },
  { value: "/tools",      label: "/tools",      hint: "available tools" },
  { value: "/safety",     label: "/safety",     hint: "bash safety rules" },
];

const SUB: Record<string, Completion[]> = {
  "/effort ": [
    { value: "/effort low",    label: "low",    hint: "haiku   · fast, cheap, no thinking" },
    { value: "/effort medium", label: "medium", hint: "sonnet  · balanced" },
    { value: "/effort high",   label: "high",   hint: "opus    · extended reasoning, higher cost" },
  ],
  "/memory ": [
    { value: "/memory search ",  label: "search <q>",          hint: "search memories by text" },
    { value: "/memory delete ",  label: "delete <type> <key>", hint: "remove memory by key" },
    { value: "/memory health",   label: "health",              hint: "brain state summary" },
  ],
};

// Commands with subcommands — Tab auto-appends a space to reveal next level
const HAS_SUB = new Set(Object.keys(SUB).map((k) => k.trimEnd()));

export function getSuggestions(input: string): Completion[] {
  if (!input.startsWith("/")) return [];

  // Subcommand context (longest prefix first)
  for (const prefix of Object.keys(SUB).sort((a, b) => b.length - a.length)) {
    if (input.startsWith(prefix)) {
      const rest = input.slice(prefix.length).toLowerCase();
      return SUB[prefix].filter((c) => c.label.toLowerCase().startsWith(rest));
    }
  }

  // Top-level: filter by what's typed after /
  if (input === "/") return TOP;
  const q = input.slice(1).toLowerCase();
  return TOP.filter((c) => c.label.slice(1).startsWith(q));
}

export function completionValue(c: Completion): string {
  return HAS_SUB.has(c.value) ? c.value + " " : c.value;
}
