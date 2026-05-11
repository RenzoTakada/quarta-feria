import React from "react";
import { Box, Text } from "ink";
import type { TokenSnapshot } from "../../agent/tokens.js";
import { formatCompact } from "../../agent/tokens.js";

interface Props {
  snap: TokenSnapshot;
  model: string;
  connected: boolean;
}

export function StatusBar({ snap, model, connected }: Props) {
  return (
    <Box>
      <Text dimColor>{formatCompact(snap, model)}</Text>
      {!connected && <Text color="red"> · desconectado</Text>}
    </Box>
  );
}
