import React from "react";
import { Box, Text } from "ink";
import type { TokenSnapshot } from "../../agent/tokens.js";
import { formatCompact } from "../../agent/tokens.js";

interface Props {
  snap: TokenSnapshot;
  model: string;
  effort: "low" | "medium" | "high";
  connected: boolean;
}

export function StatusBar({ snap, model, effort, connected }: Props) {
  return (
    <Box>
      <Text dimColor>{formatCompact(snap, model, effort)}</Text>
      {!connected && <Text color="red"> · desconectado</Text>}
    </Box>
  );
}
