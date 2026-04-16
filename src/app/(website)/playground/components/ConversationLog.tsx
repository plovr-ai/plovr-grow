"use client";

import { useEffect, useRef } from "react";
import type { ConversationMessage } from "@/lib/pipecat";

interface ConversationLogProps {
  messages: ConversationMessage[];
  interimText: string | null;
  isConnected: boolean;
}

export function ConversationLog({ messages, interimText, isConnected }: ConversationLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, interimText]);

  return (
    <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
      {messages.length === 0 && isConnected && (
        <p className="text-center text-xs text-gray-400">
          Start speaking to begin the conversation...
        </p>
      )}
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
              msg.role === "user"
                ? "rounded-tr-sm bg-gray-800 text-white"
                : "rounded-tl-sm bg-gray-100 text-gray-900"
            }`}
          >
            {msg.text}
          </div>
        </div>
      ))}
      {interimText && (
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-gray-800/60 px-3 py-2 text-sm leading-relaxed text-white/80 italic">
            {interimText}
          </div>
        </div>
      )}
    </div>
  );
}
