"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAgentChatStore } from "@/stores/agent-chat.store";
import type {
  Message,
  StreamEvent,
  QuickAction,
  ConversationContext,
  MessageContent,
} from "@/services/dashboard-agent";

interface UseAgentChatOptions {
  /** Merchant ID for API calls */
  merchantId: string;
  /** Initial welcome message */
  welcomeMessage?: Message;
}

/**
 * Hook for managing agent chat interactions
 */
export function useAgentChat({ merchantId, welcomeMessage }: UseAgentChatOptions) {
  const router = useRouter();

  const {
    conversationId,
    messages,
    context,
    isLoading,
    isStreaming,
    currentQuickActions,
    error,
    addMessage,
    updateLastMessage,
    setLoading,
    setStreaming,
    setContext,
    setQuickActions,
    setError,
    finishStreaming,
    reset,
  } = useAgentChatStore();

  // Add welcome message on mount if no messages exist
  useEffect(() => {
    if (welcomeMessage && messages.length === 0) {
      addMessage(welcomeMessage);
      // Extract quick actions from welcome message
      const quickActionsContent = welcomeMessage.content.find(
        (c) => c.type === "quick_actions"
      );
      if (quickActionsContent?.quickActions) {
        setQuickActions(quickActionsContent.quickActions);
      }
    }
  }, [welcomeMessage, messages.length, addMessage, setQuickActions]);

  /**
   * Send a message to the agent
   */
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      // Add user message
      const userMessage: Message = {
        id: `msg_${Date.now()}`,
        role: "user",
        content: [{ type: "text", text }],
        createdAt: new Date(),
      };
      addMessage(userMessage);

      setLoading(true);
      setError(null);

      try {
        // Create placeholder assistant message
        const assistantMessage: Message = {
          id: `msg_${Date.now()}_assistant`,
          role: "assistant",
          content: [],
          createdAt: new Date(),
          isStreaming: true,
        };
        addMessage(assistantMessage);
        setStreaming(true);

        // Call streaming API
        const response = await fetch(
          `/api/dashboard/${merchantId}/agent/stream`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: text,
              conversationId,
              context,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        // Process SSE stream
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let accumulatedContent: MessageContent[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event: StreamEvent = JSON.parse(line.slice(6));
                accumulatedContent = processStreamEvent(
                  event,
                  accumulatedContent,
                  setContext,
                  setQuickActions
                );
                updateLastMessage(accumulatedContent);
              } catch (e) {
                console.error("Failed to parse SSE event:", e);
              }
            }
          }
        }

        // Mark streaming as complete
        finishStreaming();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        // Remove the empty assistant message on error
        finishStreaming();
      } finally {
        setLoading(false);
      }
    },
    [
      merchantId,
      conversationId,
      context,
      isLoading,
      addMessage,
      updateLastMessage,
      setLoading,
      setStreaming,
      setError,
      setContext,
      setQuickActions,
      finishStreaming,
    ]
  );

  /**
   * Handle quick action click
   */
  const handleQuickAction = useCallback(
    async (action: QuickAction) => {
      switch (action.action.type) {
        case "send_message":
          await sendMessage(action.action.payload as string);
          break;
        case "navigate":
          router.push(action.action.payload as string);
          break;
        case "execute_tool":
          // For future tool execution
          console.log("Execute tool:", action.action.payload);
          break;
      }
    },
    [sendMessage, router]
  );

  return {
    messages,
    isLoading,
    isStreaming,
    currentQuickActions,
    error,
    sendMessage,
    handleQuickAction,
    reset,
  };
}

/**
 * Process a stream event and update accumulated content
 */
function processStreamEvent(
  event: StreamEvent,
  content: MessageContent[],
  setContext: (ctx: ConversationContext) => void,
  setQuickActions: (actions: QuickAction[]) => void
): MessageContent[] {
  const updatedContent = [...content];

  switch (event.type) {
    case "text": {
      // Append to existing text content or create new
      const lastContent = updatedContent[updatedContent.length - 1];
      if (lastContent?.type === "text") {
        lastContent.text = (lastContent.text || "") + (event.data as string);
      } else if (event.data) {
        updatedContent.push({ type: "text", text: event.data as string });
      }
      break;
    }

    case "tool_start": {
      const toolData = event.data as { toolId: string; toolName: string };
      updatedContent.push({
        type: "tool_call",
        toolCall: {
          toolId: toolData.toolId,
          toolName: toolData.toolName,
          arguments: {},
        },
      });
      break;
    }

    case "tool_end": {
      // Replace tool_call with tool_result
      const toolCallIndex = updatedContent.findIndex((c) => c.type === "tool_call");
      if (toolCallIndex !== -1) {
        const toolResult = event.data as MessageContent["toolResult"];
        updatedContent[toolCallIndex] = {
          type: "tool_result",
          toolResult,
        };
      } else {
        // Add as new content if no tool_call found
        updatedContent.push({
          type: "tool_result",
          toolResult: event.data as MessageContent["toolResult"],
        });
      }
      break;
    }

    case "progress": {
      // Find existing progress or add new
      const progressIndex = updatedContent.findIndex((c) => c.type === "progress");
      const progressData = event.data as MessageContent["progress"];
      if (progressIndex !== -1) {
        updatedContent[progressIndex] = {
          type: "progress",
          progress: progressData,
        };
      } else {
        updatedContent.push({
          type: "progress",
          progress: progressData,
        });
      }
      break;
    }

    case "quick_actions": {
      const actions = event.data as QuickAction[];
      setQuickActions(actions);
      break;
    }

    case "context_update": {
      const newContext = event.data as ConversationContext;
      setContext(newContext);
      break;
    }

    case "error": {
      updatedContent.push({
        type: "text",
        text: `Error: ${event.data}`,
      });
      break;
    }

    case "done":
      // No action needed
      break;
  }

  return updatedContent;
}
