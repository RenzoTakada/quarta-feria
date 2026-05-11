import React from "react";
import { Box, Text, useStdout } from "ink";

interface Props {
  value: string;
  busy: boolean;
  queueLen?: number;
}

export function InputArea({ value, busy, queueLen = 0 }: Props) {
  const { stdout } = useStdout();
  const hr = "─".repeat(stdout.columns || 80);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text dimColor>{hr}</Text>
      <Box>
        <Text color="cyan">❯ </Text>
        <Text>{value}</Text>
        {!busy && <Text color="cyan">█</Text>}
        {queueLen > 0 && (
          <Text dimColor>  (+{queueLen} na fila)</Text>
        )}
      </Box>
    </Box>
  );
}
