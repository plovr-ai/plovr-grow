"use client";

import { useState, useRef, useCallback, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InputAreaProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Input Area Component
 *
 * Text input with send button for chat messages.
 */
export function InputArea({
  onSend,
  disabled = false,
  placeholder = "Type a message...",
}: InputAreaProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    if (value.trim() && !disabled) {
      onSend(value.trim());
      setValue("");
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  return (
    <div className="border-t border-gray-200 p-4">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:cursor-not-allowed disabled:bg-gray-50"
          style={{ minHeight: "40px", maxHeight: "200px" }}
        />
        <Button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          size="icon"
          className="h-10 w-10 shrink-0 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="mt-2 text-center text-xs text-gray-400">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
