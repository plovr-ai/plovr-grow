"use client";

import { useRef, useEffect, useMemo } from "react";
import { Sparkles } from "lucide-react";
import { MessageList } from "./MessageList";
import { InputArea } from "./InputArea";
import { QuickActions } from "./QuickActions";
import { TypingIndicator } from "./TypingIndicator";
import { useAgentChat } from "@/hooks/useAgentChat";
import { useSubscription } from "@/hooks/useSubscription";
import type { Message, QuickAction } from "@/services/dashboard-agent";

interface AgentChatClientProps {
  /** Merchant ID for API calls */
  merchantId: string;
  /** Company name for personalization */
  companyName: string;
  /** Whether the company has a menu already */
  hasMenu?: boolean;
}

/**
 * Generate welcome message based on subscription and onboarding status
 */
function generateWelcomeMessage(
  companyName: string,
  hasMenu: boolean,
  isSubscribed: boolean
): Message {
  // Non-subscribed users: show subscription guidance
  if (!isSubscribed) {
    const quickActions: QuickAction[] = [
      {
        id: "start_trial",
        label: "Start Free Trial",
        description: "14-day free trial, no credit card required",
        action: { type: "send_message", payload: "I want to start my free trial" },
      },
      {
        id: "learn_more",
        label: "Learn More",
        description: "Tell me about the features",
        action: { type: "send_message", payload: "Tell me more about the features" },
      },
    ];

    const welcomeText =
      `Welcome to Plovr, ${companyName}!\n\n` +
      `I'm your AI assistant, here to help you get started with your online ordering system.\n\n` +
      `Before we begin, let's set up your subscription. You can start with a **14-day free trial** - no credit card required to start!\n\n` +
      `**What you'll get:**\n` +
      `- Online ordering website\n` +
      `- Menu management\n` +
      `- Order management\n` +
      `- Loyalty program\n` +
      `- Gift cards\n` +
      `- Analytics & reports\n\n` +
      `Ready to get started?`;

    return {
      id: `welcome_${Date.now()}`,
      role: "assistant",
      content: [
        { type: "text", text: welcomeText },
        { type: "quick_actions", quickActions },
      ],
      createdAt: new Date(),
    };
  }

  // Subscribed users without menu: onboarding guidance
  if (!hasMenu) {
    const quickActions: QuickAction[] = [
      {
        id: "import_menu",
        label: "Import Menu",
        description: "Import from website, DoorDash, Uber Eats, or Google",
        action: { type: "send_message", payload: "I want to import my menu" },
      },
      {
        id: "create_manual",
        label: "Create Manually",
        description: "Add menu items one by one",
        action: { type: "navigate", payload: "/dashboard/menu/items/new" },
      },
    ];

    const welcomeText =
      `Great! Your subscription is now active, ${companyName}!\n\n` +
      `Now let's set up your restaurant. I can help you:\n` +
      `1. **Import your menu** from DoorDash, UberEats, or your website\n` +
      `2. **Set up business info** like hours, address, and contact details\n` +
      `3. **Configure settings** for ordering, payments, and more\n\n` +
      `What would you like to do first?`;

    return {
      id: `welcome_${Date.now()}`,
      role: "assistant",
      content: [
        { type: "text", text: welcomeText },
        { type: "quick_actions", quickActions },
      ],
      createdAt: new Date(),
    };
  }

  // Subscribed users with menu: normal welcome
  const quickActions: QuickAction[] = [
    {
      id: "view_menu",
      label: "View Menu",
      action: { type: "navigate", payload: "/dashboard/menu" },
    },
    {
      id: "view_orders",
      label: "View Orders",
      action: { type: "navigate", payload: "/dashboard/orders" },
    },
  ];

  const welcomeText = `Welcome back to ${companyName}! I'm your AI assistant.\n\nHow can I help you today?`;

  return {
    id: `welcome_${Date.now()}`,
    role: "assistant",
    content: [
      { type: "text", text: welcomeText },
      { type: "quick_actions", quickActions },
    ],
    createdAt: new Date(),
  };
}

/**
 * Agent Chat Client
 *
 * Main chat interface component for the Dashboard Agent.
 */
export function AgentChatClient({
  merchantId,
  companyName,
  hasMenu = false,
}: AgentChatClientProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isActive: isSubscribed } = useSubscription();

  const welcomeMessage = useMemo(
    () => generateWelcomeMessage(companyName, hasMenu, isSubscribed),
    [companyName, hasMenu, isSubscribed]
  );

  const {
    messages,
    isLoading,
    isStreaming,
    currentQuickActions,
    error,
    sendMessage,
    handleQuickAction,
  } = useAgentChat({
    merchantId,
    welcomeMessage,
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const handleSendMessage = async (text: string) => {
    await sendMessage(text);
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-200px)] max-w-3xl flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="font-medium text-gray-900">AI Assistant</h2>
          <p className="text-sm text-gray-500">
            I can help you manage {companyName}
          </p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <MessageList messages={messages} />

        {isStreaming && <TypingIndicator />}

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {currentQuickActions.length > 0 && (
        <QuickActions
          actions={currentQuickActions}
          onActionClick={handleQuickAction}
          disabled={isLoading}
        />
      )}

      {/* Input Area */}
      <InputArea
        onSend={handleSendMessage}
        disabled={isLoading}
        placeholder="Type a message or paste a URL..."
      />
    </div>
  );
}
