import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";

const DOTS = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];

function kfmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

interface Props {
  startTime: number;
  thinkingDone: boolean;
  thinkingMs: number;
  outputChars: number;
}

export function ThinkingIndicator({ startTime, thinkingDone, thinkingMs, outputChars }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 100);
    return () => clearInterval(t);
  }, []);

  const elapsed   = Math.round((Date.now() - startTime) / 1000);
  const spinner   = DOTS[tick % DOTS.length];
  const thoughtFor = thinkingDone
    ? `pensou por ${Math.round(thinkingMs / 1000)}s`
    : "raciocínio…";
  const tokensPart = outputChars > 0 ? ` · ↓ ${kfmt(outputChars)} chars` : "";

  return (
    <Box>
      <Text color="cyan" bold>{spinner} Pensando… </Text>
      <Text dimColor>({elapsed}s{tokensPart} · {thoughtFor})</Text>
    </Box>
  );
}
