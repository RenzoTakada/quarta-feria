import React from "react";
import { Box, Text } from "ink";
import type { ChatMessage } from "../App.js";

interface Props {
  messages: ChatMessage[];
}

export function Messages({ messages }: Props) {
  return (
    <Box flexDirection="column" flexGrow={1} paddingTop={1}>
      {messages.map((msg) => (
        <Box key={msg.id} flexDirection="column" marginBottom={1}>
          <Text bold color={msg.role === "user" ? "white" : "green"}>
            {msg.role === "user" ? "você" : "quarta-feira"}:
          </Text>
          <Text wrap="wrap">{msg.content}</Text>
        </Box>
      ))}
    </Box>
  );
}
