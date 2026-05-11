import React from "react";
import { Box, Text } from "ink";
import type { Completion } from "../completions.js";

interface Props {
  suggestions: Completion[];
  selectedIdx: number;
}

export function Suggestions({ suggestions, selectedIdx }: Props) {
  if (!suggestions.length) return null;

  const labelW = Math.max(...suggestions.map((s) => s.label.length)) + 2;

  return (
    <Box flexDirection="column" paddingLeft={2}>
      {suggestions.map((s, i) => {
        const selected = i === selectedIdx;
        return (
          <Box key={s.value}>
            <Text color="cyan" bold={selected} inverse={selected}>
              {` ${s.label.padEnd(labelW)}`}
            </Text>
            <Text dimColor={!selected}>{"  "}{s.hint}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
