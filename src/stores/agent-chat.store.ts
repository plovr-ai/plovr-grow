"use client";

import { create } from "zustand";
import type {
  Message,
  ConversationContext,
  QuickAction,
} from "@/services/dashboard-agent";

/**
 * Agent Chat State
 */
interface AgentChatState {
  /** Current conversation ID */
  conversationId: string | null;
  /** Chat messages */
  messages: Message[];
  /** Conversation context */
  context: ConversationContext;
  /** Loading state (waiting for response) */
  isLoading: boolean;
  /** Streaming state (receiving streamed response) */
  isStreaming: boolean;
  /** Current quick actions to display */
  currentQuickActions: QuickAction[];
  /** Error message */
  error: string | null;
}

/**
 * Agent Chat Actions
 */
interface AgentChatActions {
  /** Add a message to the chat */
  addMessage: (message: Message) => void;
  /** Update the content of the last message (for streaming) */
  updateLastMessage: (content: Message["content"]) => void;
  /** Append content to the last message */
  appendToLastMessage: (content: Message["content"][0]) => void;
  /** Set loading state */
  setLoading: (loading: boolean) => void;
  /** Set streaming state */
  setStreaming: (streaming: boolean) => void;
  /** Set conversation ID */
  setConversationId: (id: string) => void;
  /** Set conversation context */
  setContext: (context: ConversationContext) => void;
  /** Set quick actions */
  setQuickActions: (actions: QuickAction[]) => void;
  /** Set error */
  setError: (error: string | null) => void;
  /** Reset the chat state */
  reset: () => void;
  /** Mark last message as not streaming */
  finishStreaming: () => void;
}

type AgentChatStore = AgentChatState & AgentChatActions;

const initialState: AgentChatState = {
  conversationId: null,
  messages: [],
  context: { slots: {} },
  isLoading: false,
  isStreaming: false,
  currentQuickActions: [],
  error: null,
};

/**
 * Agent Chat Store
 *
 * Zustand store for managing chat state.
 * Stores messages in memory only (not persisted).
 */
export const useAgentChatStore = create<AgentChatStore>()((set) => ({
  ...initialState,

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
      // Clear quick actions when a new message is added
      currentQuickActions: [],
    })),

  updateLastMessage: (content) =>
    set((state) => {
      const messages = [...state.messages];
      if (messages.length > 0) {
        messages[messages.length - 1] = {
          ...messages[messages.length - 1],
          content,
        };
      }
      return { messages };
    }),

  appendToLastMessage: (contentItem) =>
    set((state) => {
      const messages = [...state.messages];
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        messages[messages.length - 1] = {
          ...lastMessage,
          content: [...lastMessage.content, contentItem],
        };
      }
      return { messages };
    }),

  setLoading: (isLoading) => set({ isLoading }),

  setStreaming: (isStreaming) => set({ isStreaming }),

  setConversationId: (conversationId) => set({ conversationId }),

  setContext: (context) => set({ context }),

  setQuickActions: (currentQuickActions) => set({ currentQuickActions }),

  setError: (error) => set({ error }),

  finishStreaming: () =>
    set((state) => {
      const messages = [...state.messages];
      if (messages.length > 0) {
        messages[messages.length - 1] = {
          ...messages[messages.length - 1],
          isStreaming: false,
        };
      }
      return { messages, isStreaming: false };
    }),

  reset: () => set(initialState),
}));
