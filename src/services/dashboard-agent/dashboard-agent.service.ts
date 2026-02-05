import type {
  Message,
  MessageContent,
  SendMessageRequest,
  ConversationContext,
  IntentResult,
  StreamEvent,
  QuickAction,
} from "./dashboard-agent.types";
import { toolRegistry, extractUrlsFromMessage } from "./tools";
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
    companyId: string,
    merchantId: string,
    userId: string,
    request: SendMessageRequest
  ): AsyncGenerator<StreamEvent> {
    const { message, context } = request;
    const currentContext: ConversationContext = {
      slots: {},
      ...context,
    };

    // Step 1: Classify intent
    const intent = await intentClassifier.classify(message, currentContext);

    // Step 2: Check if this is a URL-containing message for onboarding
    const extractedUrls = extractUrlsFromMessage(message);
    const hasUrls = Object.keys(extractedUrls).length > 0;

    // Step 3: Determine response strategy
    if (hasUrls && (intent.category === "onboarding" || currentContext.onboardingState?.status === "collecting_urls")) {
      // Execute onboarding import
      yield* this.handleOnboardingImport(
        tenantId,
        companyId,
        merchantId,
        userId,
        extractedUrls,
        currentContext
      );
    } else if (intent.category === "onboarding" && !hasUrls) {
      // User wants to import but hasn't provided URLs yet
      yield* this.handleOnboardingStart(currentContext);
    } else if (intent.category === "general_help" || intent.confidence < 0.5) {
      // Show help or handle unknown intent
      yield* this.handleGeneralResponse(intent, currentContext);
    } else {
      // For other intents, provide guidance (tools not implemented yet)
      yield* this.handleNotImplemented(intent, currentContext);
    }
  }

  /**
   * Handle onboarding start - prompt user for URLs
   */
  private async *handleOnboardingStart(
    context: ConversationContext
  ): AsyncGenerator<StreamEvent> {
    // Update context to collecting_urls state
    const updatedContext: ConversationContext = {
      ...context,
      onboardingState: {
        status: "collecting_urls",
        collectedUrls: {},
      },
      activeIntent: {
        category: "onboarding",
        action: "import_menu",
        confidence: 1,
        entities: {},
      },
    };

    yield {
      type: "text",
      data: "I'd be happy to help you import your menu! Please provide at least one of the following URLs:\n\n" +
        "• **Your Website** - Your restaurant's official website\n" +
        "• **DoorDash** - Your DoorDash store page\n" +
        "• **Uber Eats** - Your Uber Eats store page\n" +
        "• **Google Business** - Your Google Business profile\n\n" +
        "Just paste the URL(s) and I'll extract your menu automatically.",
    };

    yield {
      type: "context_update",
      data: updatedContext,
    };

    yield { type: "done", data: null };
  }

  /**
   * Handle onboarding import - execute the tool
   */
  private async *handleOnboardingImport(
    tenantId: string,
    companyId: string,
    merchantId: string,
    userId: string,
    urls: Record<string, string>,
    context: ConversationContext
  ): AsyncGenerator<StreamEvent> {
    const tool = toolRegistry.get("onboarding_import");
    if (!tool) {
      yield { type: "error", data: "Import tool not available" };
      yield { type: "done", data: null };
      return;
    }

    // Validate URLs
    const validation = tool.validateArgs(urls);
    if (!validation.valid) {
      yield {
        type: "text",
        data: `I couldn't process the URLs: ${validation.errors?.join(", ")}. Please check and try again.`,
      };
      yield { type: "done", data: null };
      return;
    }

    // Update context
    const updatedContext: ConversationContext = {
      ...context,
      onboardingState: {
        status: "importing",
        collectedUrls: urls as { website?: string; doordash?: string; ubereats?: string; google?: string },
      },
    };

    yield {
      type: "context_update",
      data: updatedContext,
    };

    // Notify tool start
    yield {
      type: "tool_start",
      data: {
        toolId: tool.definition.id,
        toolName: tool.definition.name,
      },
    };

    // Show progress
    yield {
      type: "progress",
      data: {
        stage: "scraping",
        progress: 20,
        message: `Fetching data from ${Object.keys(urls).length} source(s)...`,
      },
    };

    // Execute the tool
    try {
      const result = await tool.execute(urls, {
        tenantId,
        companyId,
        merchantId,
        userId,
        conversationContext: context,
      });

      // Update progress
      yield {
        type: "progress",
        data: {
          stage: "complete",
          progress: 100,
          message: "Import complete!",
        },
      };

      // Tool result
      yield {
        type: "tool_end",
        data: result,
      };

      // Generate follow-up text
      if (result.success && result.data) {
        const importResult = result.data as { created: { categories: unknown[]; items: unknown[] }; warnings: string[] };
        const categoryCount = importResult.created?.categories?.length || 0;
        const itemCount = importResult.created?.items?.length || 0;

        yield {
          type: "text",
          data: `Great news! I successfully imported your menu:\n\n` +
            `• **${categoryCount}** categories\n` +
            `• **${itemCount}** menu items\n\n` +
            (importResult.warnings?.length > 0
              ? `⚠️ There were ${importResult.warnings.length} warning(s) during import.\n\n`
              : "") +
            `You can now view and edit your menu in the Menu section.`,
        };

        // Provide quick actions
        yield {
          type: "quick_actions",
          data: [
            {
              id: "view_menu",
              label: "View Menu",
              action: { type: "navigate", payload: "/dashboard/menu" },
            },
            {
              id: "import_again",
              label: "Import Again",
              action: { type: "send_message", payload: "I want to import my menu" },
            },
          ] as QuickAction[],
        };

        // Update context to completed
        yield {
          type: "context_update",
          data: {
            ...context,
            onboardingState: {
              status: "completed",
              collectedUrls: urls as { website?: string; doordash?: string; ubereats?: string; google?: string },
            },
          },
        };
      } else {
        yield {
          type: "text",
          data: `I encountered an issue while importing: ${result.error || "Unknown error"}. ` +
            `Please check the URLs and try again, or you can create your menu manually.`,
        };

        yield {
          type: "quick_actions",
          data: [
            {
              id: "try_again",
              label: "Try Again",
              action: { type: "send_message", payload: "I want to import my menu" },
            },
            {
              id: "create_manual",
              label: "Create Manually",
              action: { type: "navigate", payload: "/dashboard/menu/items/new" },
            },
          ] as QuickAction[],
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
        data: "Sorry, something went wrong during the import. Please try again later.",
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
   */
  getWelcomeMessage(companyName: string, hasMenu: boolean): Message {
    const content: MessageContent[] = [];

    if (!hasMenu) {
      content.push({
        type: "text",
        text: `Welcome to ${companyName}! I'm your AI assistant.\n\n` +
          `I noticed you haven't set up your menu yet. Would you like me to help you import it from your existing sources?`,
      });
    } else {
      content.push({
        type: "text",
        text: `Welcome back to ${companyName}! I'm your AI assistant.\n\n` +
          `How can I help you today?`,
      });
    }

    content.push({
      type: "quick_actions",
      quickActions: !hasMenu
        ? [
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
          ]
        : [
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
