import { BaseTool } from "./tool.interface";
import type {
  ToolDefinition,
  ToolExecutionContext,
  ToolResultContent,
  ToolValidationResult,
} from "../dashboard-agent.types";
import {
  onboardingAgentService,
  type DataSourceType,
  type ImportSource,
} from "@/services/onboarding-agent";

/**
 * URL patterns for different data sources
 */
const URL_PATTERNS: Record<DataSourceType, RegExp> = {
  website: /^https?:\/\/.+/i,
  doordash: /doordash\.com/i,
  ubereats: /ubereats\.com/i,
  google_business: /google\.com\/(maps|search)/i,
};

/**
 * Onboarding Import Tool
 *
 * Allows users to import their restaurant menu from external sources
 * like their website, DoorDash, Uber Eats, or Google Business.
 */
class OnboardingTool extends BaseTool {
  definition: ToolDefinition = {
    id: "onboarding_import",
    name: "Import Menu",
    description:
      "Import restaurant menu from website, DoorDash, UberEats, or Google Business",
    triggerKeywords: [
      "import",
      "导入",
      "website",
      "doordash",
      "ubereats",
      "uber eats",
      "menu",
      "菜单",
      "scrape",
      "extract",
      "google business",
      "url",
      "link",
      "链接",
    ],
    parameters: [
      {
        name: "website",
        type: "string",
        description: "Restaurant website URL",
        required: false,
      },
      {
        name: "doordash",
        type: "string",
        description: "DoorDash store page URL",
        required: false,
      },
      {
        name: "ubereats",
        type: "string",
        description: "Uber Eats store page URL",
        required: false,
      },
      {
        name: "google",
        type: "string",
        description: "Google Business profile URL",
        required: false,
      },
    ],
  };

  /**
   * Custom validation: at least one URL is required
   */
  validateArgs(args: Record<string, unknown>): ToolValidationResult {
    const urlKeys = ["website", "doordash", "ubereats", "google"];
    const hasAtLeastOneUrl = urlKeys.some(
      (key) => typeof args[key] === "string" && (args[key] as string).trim()
    );

    if (!hasAtLeastOneUrl) {
      return {
        valid: false,
        errors: ["At least one URL is required"],
      };
    }

    // Validate URL formats
    const errors: string[] = [];
    for (const key of urlKeys) {
      const url = args[key];
      if (typeof url === "string" && url.trim()) {
        try {
          new URL(url);
        } catch {
          errors.push(`Invalid URL format for ${key}: ${url}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Execute the import
   */
  async execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResultContent> {
    const { tenantId, companyId, merchantId } = context;

    // Build sources array from provided URLs
    const sources: ImportSource[] = [];

    if (args.website && typeof args.website === "string" && args.website.trim()) {
      sources.push({ type: "website", url: args.website.trim() });
    }
    if (args.doordash && typeof args.doordash === "string" && args.doordash.trim()) {
      sources.push({ type: "doordash", url: args.doordash.trim() });
    }
    if (args.ubereats && typeof args.ubereats === "string" && args.ubereats.trim()) {
      sources.push({ type: "ubereats", url: args.ubereats.trim() });
    }
    if (args.google && typeof args.google === "string" && args.google.trim()) {
      sources.push({ type: "google_business", url: args.google.trim() });
    }

    try {
      const result = await onboardingAgentService.importFromSources(
        tenantId,
        companyId,
        merchantId,
        sources
      );

      return {
        toolId: this.definition.id,
        toolName: this.definition.name,
        success: result.success,
        data: result,
        renderAs: "menu-import-result",
      };
    } catch (error) {
      return {
        toolId: this.definition.id,
        toolName: this.definition.name,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }
}

/**
 * Extract URLs from user message
 * @param message - User message that may contain URLs
 * @returns Object with detected URLs by type
 */
export function extractUrlsFromMessage(message: string): Record<string, string> {
  const urls: Record<string, string> = {};

  // Extract all URLs from message
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;
  const matches = message.match(urlRegex) || [];

  for (const url of matches) {
    // Determine source type based on URL pattern
    if (URL_PATTERNS.doordash.test(url)) {
      urls.doordash = url;
    } else if (URL_PATTERNS.ubereats.test(url)) {
      urls.ubereats = url;
    } else if (URL_PATTERNS.google_business.test(url)) {
      urls.google = url;
    } else if (URL_PATTERNS.website.test(url)) {
      // Generic website URL (if not matched by other patterns)
      if (!urls.website) {
        urls.website = url;
      }
    }
  }

  return urls;
}

// Export singleton instance
export const onboardingTool = new OnboardingTool();
