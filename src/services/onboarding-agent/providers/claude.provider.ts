/**
 * Claude (Anthropic) AI Provider
 *
 * Implements AI extraction using Claude models.
 */

import type {
  AIExtractionResult,
  ExtractionSchema,
  ExtractedRestaurantInfo,
  ExtractedMenuCategory,
} from "../onboarding-agent.types";
import type { AIProvider } from "./ai-provider.interface";
import {
  RESTAURANT_INFO_PROMPT,
  MENU_EXTRACTION_PROMPT,
  DOORDASH_MENU_PROMPT,
  UBEREATS_MENU_PROMPT,
  GOOGLE_BUSINESS_PROMPT,
} from "./ai-provider.interface";

interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: { type: string; text: string }[];
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class ClaudeProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY ?? "";
    this.model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
    this.baseUrl = "https://api.anthropic.com/v1";
  }

  getProviderName(): string {
    return `claude (${this.model})`;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async extractStructuredData<T>(
    content: string,
    schema: ExtractionSchema,
    instructions: string
  ): Promise<AIExtractionResult<T>> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "Claude API key not configured (ANTHROPIC_API_KEY)",
      };
    }

    try {
      const prompt = instructions.replace("{{CONTENT}}", content);

      const response = await fetch(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ] as ClaudeMessage[],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Claude API error: ${response.status} - ${errorText}`,
        };
      }

      const result = (await response.json()) as ClaudeResponse;
      const text = result.content[0]?.text ?? "";

      // Parse JSON from response
      const data = this.parseJsonResponse<T>(text);
      if (!data) {
        return {
          success: false,
          error: "Failed to parse JSON from Claude response",
        };
      }

      return {
        success: true,
        data,
        tokensUsed: result.usage.input_tokens + result.usage.output_tokens,
        model: result.model,
      };
    } catch (error) {
      return {
        success: false,
        error: `Claude extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  async extractRestaurantInfo(
    content: string,
    sourceType: string
  ): Promise<AIExtractionResult<ExtractedRestaurantInfo>> {
    const prompt = this.getRestaurantPrompt(sourceType);
    return this.extractStructuredData<ExtractedRestaurantInfo>(
      content,
      { type: "restaurant_info", fields: [] },
      prompt
    );
  }

  async extractMenu(
    content: string,
    sourceType: string
  ): Promise<AIExtractionResult<{ categories: ExtractedMenuCategory[] }>> {
    const prompt = this.getMenuPrompt(sourceType);
    return this.extractStructuredData<{ categories: ExtractedMenuCategory[] }>(
      content,
      { type: "menu", fields: [] },
      prompt
    );
  }

  private getRestaurantPrompt(sourceType: string): string {
    switch (sourceType) {
      case "google_business":
        return GOOGLE_BUSINESS_PROMPT;
      default:
        return RESTAURANT_INFO_PROMPT;
    }
  }

  private getMenuPrompt(sourceType: string): string {
    switch (sourceType) {
      case "doordash":
        return DOORDASH_MENU_PROMPT;
      case "ubereats":
        return UBEREATS_MENU_PROMPT;
      default:
        return MENU_EXTRACTION_PROMPT;
    }
  }

  private parseJsonResponse<T>(text: string): T | null {
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
      return JSON.parse(jsonStr) as T;
    } catch {
      // Try parsing the raw text
      try {
        return JSON.parse(text) as T;
      } catch {
        return null;
      }
    }
  }
}
