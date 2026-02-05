"use client";

import { Sparkles } from "lucide-react";

/**
 * Typing Indicator Component
 *
 * Shows animated dots while the agent is processing/typing.
 */
export function TypingIndicator() {
  return (
    <div className="flex gap-3 py-2">
      {/* Avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500">
        <Sparkles className="h-4 w-4 text-white" />
      </div>

      {/* Typing dots */}
      <div className="flex items-center gap-1 rounded-lg bg-gray-100 px-4 py-2">
        <div
          className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
          style={{ animationDelay: "0ms" }}
        />
        <div
          className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
          style={{ animationDelay: "150ms" }}
        />
        <div
          className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
          style={{ animationDelay: "300ms" }}
        />
      </div>
    </div>
  );
}
