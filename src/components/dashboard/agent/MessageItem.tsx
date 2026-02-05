"use client";

import { User, Sparkles } from "lucide-react";
import { ToolResultCard } from "./ToolResultCard";
import { ProgressCard } from "./ProgressCard";
import type { Message, MessageContent } from "@/services/dashboard-agent";

interface MessageItemProps {
  message: Message;
}

/**
 * Message Item Component
 *
 * Displays a single chat message with its content.
 */
export function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === "user";

  // Filter out quick_actions from rendering (they're shown separately)
  const displayContent = message.content.filter(
    (content) => content.type !== "quick_actions"
  );

  // Don't render empty messages
  if (displayContent.length === 0) {
    return null;
  }

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser
            ? "bg-blue-500"
            : "bg-gradient-to-br from-purple-500 to-pink-500"
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4 text-white" />
        ) : (
          <Sparkles className="h-4 w-4 text-white" />
        )}
      </div>

      {/* Content */}
      <div
        className={`flex max-w-[80%] flex-col gap-2 ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        {displayContent.map((content, index) => (
          <MessageContentRenderer
            key={index}
            content={content}
            isUser={isUser}
          />
        ))}
      </div>
    </div>
  );
}

interface MessageContentRendererProps {
  content: MessageContent;
  isUser: boolean;
}

/**
 * Render individual message content based on type
 */
function MessageContentRenderer({
  content,
  isUser,
}: MessageContentRendererProps) {
  switch (content.type) {
    case "text":
      return (
        <div
          className={`rounded-lg px-4 py-2 ${
            isUser ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-900"
          }`}
        >
          <div className="whitespace-pre-wrap text-sm">
            {formatText(content.text || "")}
          </div>
        </div>
      );

    case "tool_call":
      return (
        <div className="flex items-center gap-2 rounded-lg bg-purple-50 px-3 py-2 text-sm text-purple-700">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-300 border-t-purple-600" />
          <span>Running {content.toolCall?.toolName}...</span>
        </div>
      );

    case "tool_result":
      if (!content.toolResult) return null;
      return <ToolResultCard result={content.toolResult} />;

    case "progress":
      if (!content.progress) return null;
      return <ProgressCard progress={content.progress} />;

    default:
      return null;
  }
}

/**
 * Format text with basic markdown support (bold)
 */
function formatText(text: string): React.ReactNode {
  // Split by bold markers (**text**)
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
