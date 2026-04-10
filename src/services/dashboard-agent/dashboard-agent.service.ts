import type {
  Message,
  MessageContent,
  SendMessageRequest,
  ConversationContext,
  IntentResult,
  StreamEvent,
  QuickAction,
} from "./dashboard-agent.types";
import { toolRegistry } from "./tools";
import { intentClassifier } from "./intent";

/**
 * Dashboard Agent Service
 *
 * Main orchestration service for the conversational AI agent.
 * Handles message processing, intent classification, and tool execution.
 */
export class DashboardAgentService {
  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generate a unique conversation ID
   */
  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Process user message with streaming response
   * This is the main entry point for the agent
   */
  async *processMessageStream(
    tenantId: string,
    merchantId: string,
    userId: string,
    request: SendMessageRequest
  ): AsyncGenerator<StreamEvent> {
    const { message, context } = request;
    const currentContext: ConversationContext = {
      slots: {},
      ...context,
    };

    // Step 1: Check subscription status - non-subscribed users get guided to subscribe
    const isSubscribed = currentContext.subscription?.canAccessPremiumFeatures ?? false;

    // Step 2: Classify intent
    const intent = await intentClassifier.classify(message, currentContext);

    // Step 3: Determine response strategy
    // For non-subscribed users, prioritize subscription guidance
    if (!isSubscribed) {
      // Allow subscription-related intents or explicit subscription requests
      if (intent.category === "subscription" ||
          message.toLowerCase().includes("trial") ||
          message.toLowerCase().includes("subscribe") ||
          message.toLowerCase().includes("订阅") ||
          message.toLowerCase().includes("试用")) {
        yield* this.handleSubscriptionCheckout(tenantId, merchantId, userId, currentContext);
      } else {
        // Guide non-subscribed users to subscribe first
        yield* this.handleSubscriptionGuidance(currentContext);
      }
      return;
    }

    // Subscribed users: normal flow
    if (intent.category === "general_help" || intent.confidence < 0.5) {
      // Show help or handle unknown intent
      yield* this.handleGeneralResponse(intent, currentContext);
    } else {
      // For other intents, provide guidance (tools not implemented yet)
      yield* this.handleNotImplemented(intent, currentContext);
    }
  }

  /**
   * Handle subscription guidance for non-subscribed users
   */
  private async *handleSubscriptionGuidance(
    _context: ConversationContext
  ): AsyncGenerator<StreamEvent> {
    yield {
      type: "text",
      data: "Before you can access the Dashboard features, please start your free trial.\n\n" +
        "**What you'll get:**\n" +
        "• Online ordering website\n" +
        "• Menu management\n" +
        "• Order management\n" +
        "• Loyalty program\n" +
        "• Gift cards\n" +
        "• Analytics & reports\n\n" +
        "Ready to get started? Click the button below!",
    };

    yield {
      type: "quick_actions",
      data: [
        {
          id: "start_trial",
          label: "Start Free Trial",
          description: "14-day free trial, no credit card required",
          action: { type: "send_message", payload: "I want to start my free trial" },
        },
      ] as QuickAction[],
    };

    yield { type: "done", data: null };
  }

  /**
   * Handle subscription checkout - execute the subscription tool
   */
  private async *handleSubscriptionCheckout(
    tenantId: string,
    merchantId: string,
    userId: string,
    context: ConversationContext
  ): AsyncGenerator<StreamEvent> {
    const tool = toolRegistry.get("subscription_checkout");
    if (!tool) {
      yield { type: "error", data: "Subscription tool not available" };
      yield { type: "done", data: null };
      return;
    }

    // Notify tool start
    yield {
      type: "tool_start",
      data: {
        toolId: tool.definition.id,
        toolName: tool.definition.name,
      },
    };

    try {
      const result = await tool.execute({}, {
        tenantId,
        merchantId,
        userId,
        conversationContext: context,
      });

      // Tool result
      yield {
        type: "tool_end",
        data: result,
      };

      if (result.success && result.data) {
        const data = result.data as { checkoutUrl: string; message: string };
        yield {
          type: "text",
          data: data.message,
        };

        yield {
          type: "quick_actions",
          data: [
            {
              id: "go_to_checkout",
              label: "Continue to Checkout",
              action: { type: "navigate", payload: data.checkoutUrl },
            },
          ] as QuickAction[],
        };
      } else {
        yield {
          type: "text",
          data: `Sorry, I couldn't create a checkout session: ${result.error || "Unknown error"}. Please try again later.`,
        };
      }
    } catch (error) {
      yield {
        type: "tool_end",
        data: {
          toolId: tool.definition.id,
          toolName: tool.definition.name,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };

      yield {
        type: "text",
        data: "Sorry, something went wrong. Please try again later.",
      };
    }

    yield { type: "done", data: null };
  }

  /**
   * Handle general response for help or unknown intents
   */
  private async *handleGeneralResponse(
    _intent: unknown,
    _context: unknown
  ): AsyncGenerator<StreamEvent> {
    yield {
      type: "text",
      data: "Hi! I'm your AI assistant. Here's what I can help you with:\n\n" +
        "• **Import Menu** - Import your menu from your website, DoorDash, Uber Eats, or Google Business\n\n" +
        "More features coming soon! For now, try saying \"I want to import my menu\" to get started.",
    };

    yield {
      type: "quick_actions",
      data: [
        {
          id: "import_menu",
          label: "Import Menu",
          action: { type: "send_message", payload: "I want to import my menu" },
        },
        {
          id: "view_menu",
          label: "View Menu",
          action: { type: "navigate", payload: "/dashboard/menu" },
        },
      ] as QuickAction[],
    };

    yield { type: "done", data: null };
  }

  /**
   * Handle not implemented features
   */
  private async *handleNotImplemented(
    intent: IntentResult,
    _context: unknown
  ): AsyncGenerator<StreamEvent> {
    const featureNames: Record<string, string> = {
      menu_management: "Menu Management",
      order_management: "Order Management",
      reports: "Reports & Analytics",
      settings: "Settings",
    };

    const featureName = featureNames[intent.category] || intent.category;

    yield {
      type: "text",
      data: `**${featureName}** is coming soon! For now, I can help you import your menu. ` +
        `You can also access ${featureName.toLowerCase()} directly from the sidebar.`,
    };

    yield {
      type: "quick_actions",
      data: [
        {
          id: "import_menu",
          label: "Import Menu",
          action: { type: "send_message", payload: "I want to import my menu" },
        },
      ] as QuickAction[],
    };

    yield { type: "done", data: null };
  }

  /**
   * Generate welcome message for first-time users
   * @param companyName - Company name for personalization
   * @param hasMenu - Whether the company has menu items
   * @param isSubscribed - Whether the user has an active subscription
   */
  getWelcomeMessage(companyName: string, hasMenu: boolean, isSubscribed: boolean = true): Message {
    const content: MessageContent[] = [];

    // Non-subscribed users: show subscription guidance
    if (!isSubscribed) {
      content.push({
        type: "text",
        text: `👋 Welcome to Plovr, ${companyName}!\n\n` +
          `I'm your AI assistant, here to help you get started with your online ordering system.\n\n` +
          `Before we begin, let's set up your subscription. You can start with a **14-day free trial** - no credit card required to start!\n\n` +
          `**What you'll get:**\n` +
          `✅ Online ordering website\n` +
          `✅ Menu management\n` +
          `✅ Order management\n` +
          `✅ Loyalty program\n` +
          `✅ Gift cards\n` +
          `✅ Analytics & reports\n\n` +
          `Ready to get started?`,
      });

      content.push({
        type: "quick_actions",
        quickActions: [
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
        ],
      });

      return {
        id: this.generateMessageId(),
        role: "assistant",
        content,
        createdAt: new Date(),
      };
    }

    // Subscribed users without menu: simple welcome
    if (!hasMenu) {
      content.push({
        type: "text",
        text: `Welcome to ${companyName}! I'm your AI assistant.\n\nHow can I help you today?`,
      });

      content.push({
        type: "quick_actions",
        quickActions: [
          {
            id: "view_menu",
            label: "Manage Menu",
            action: { type: "navigate", payload: "/dashboard/menu" },
          },
        ],
      });
    } else {
      // Subscribed users with menu: normal welcome
      content.push({
        type: "text",
        text: `Welcome back to ${companyName}! I'm your AI assistant.\n\n` +
          `How can I help you today?`,
      });

      content.push({
        type: "quick_actions",
        quickActions: [
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
        ],
      });
    }

    return {
      id: this.generateMessageId(),
      role: "assistant",
      content,
      createdAt: new Date(),
    };
  }
}

// Singleton instance
export const dashboardAgentService = new DashboardAgentService();
