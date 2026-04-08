import { BaseTool } from "./tool.interface";
import type {
  ToolDefinition,
  ToolExecutionContext,
  ToolResultContent,
  ToolValidationResult,
  QuickAction,
} from "../dashboard-agent.types";
import { subscriptionService } from "@/services/subscription";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Subscription Checkout Tool
 *
 * Helps users start their subscription or free trial by creating a
 * Stripe Checkout session and redirecting them to complete payment.
 */
class SubscriptionTool extends BaseTool {
  definition: ToolDefinition = {
    id: "subscription_checkout",
    name: "Start Subscription",
    description: "Create a checkout session to start subscription or free trial",
    triggerKeywords: [
      "subscribe",
      "subscription",
      "trial",
      "free trial",
      "start trial",
      "upgrade",
      "billing",
      "订阅",
      "试用",
      "免费试用",
      "升级",
    ],
    parameters: [],
  };

  /**
   * No arguments required for subscription checkout
   */
  validateArgs(_args: Record<string, unknown>): ToolValidationResult {
    return { valid: true };
  }

  /**
   * Execute subscription checkout
   */
  async execute(
    _args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResultContent> {
    const { tenantId } = context;

    try {
      // Create Stripe Checkout session for subscription
      const result = await subscriptionService.createCheckoutSession(tenantId, "starter", {
        successUrl: `${APP_URL}/dashboard?subscription=success`,
        cancelUrl: `${APP_URL}/dashboard?subscription=canceled`,
      });

      const quickActions: QuickAction[] = [
        {
          id: "go_to_checkout",
          label: "Continue to Checkout",
          action: {
            type: "navigate",
            payload: result.url,
          },
        },
      ];

      return {
        toolId: this.definition.id,
        toolName: this.definition.name,
        success: true,
        data: {
          checkoutUrl: result.url,
          sessionId: result.sessionId,
          message:
            "Great! Click the button below to start your 14-day free trial. No credit card required!",
        },
        renderAs: "subscription-checkout",
      };
    } catch (error) {
      return {
        toolId: this.definition.id,
        toolName: this.definition.name,
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create checkout session",
      };
    }
  }
}

// Export singleton instance
export const subscriptionTool = new SubscriptionTool();
