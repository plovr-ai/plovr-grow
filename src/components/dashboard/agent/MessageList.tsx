"use client";

import { MessageItem } from "./MessageItem";
import type { Message } from "@/services/dashboard-agent";

interface MessageListProps {
  messages: Message[];
}

/**
 * Message List Component
 *
 * Displays a list of chat messages.
 */
export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
    </div>
  );
}
