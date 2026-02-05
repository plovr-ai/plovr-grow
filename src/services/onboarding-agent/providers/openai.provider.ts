/**
 * OpenAI AI Provider
 *
 * Implements AI extraction using OpenAI GPT models.
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

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY ?? "";
    this.model = process.env.OPENAI_MODEL ?? "gpt-4o";
    this.baseUrl = "https://api.openai.com/v1";
  }

  getProviderName(): string {
    return `openai (${this.model})`;
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
        error: "OpenAI API key not configured (OPENAI_API_KEY)",
      };
    }

    try {
      const prompt = instructions.replace("{{CONTENT}}", content);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "system",
              content:
                "You are a data extraction assistant. Always respond with valid JSON only, no explanations.",
            },
            {
              role: "user",
              content: prompt,
            },
          ] as OpenAIMessage[],
          max_tokens: 4096,
          temperature: 0.1, // Low temperature for consistent extraction
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `OpenAI API error: ${response.status} - ${errorText}`,
        };
      }

      const result = (await response.json()) as OpenAIResponse;
      const text = result.choices[0]?.message?.content ?? "";

      // Parse JSON from response
      const data = this.parseJsonResponse<T>(text);
      if (!data) {
        return {
          success: false,
          error: "Failed to parse JSON from OpenAI response",
        };
      }

      return {
        success: true,
        data,
        tokensUsed: result.usage.total_tokens,
        model: result.model,
      };
    } catch (error) {
      return {
        success: false,
        error: `OpenAI extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
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
      return JSON.parse(text) as T;
    } catch {
      // Try to extract JSON from markdown code blocks
      try {
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[1].trim()) as T;
        }
      } catch {
        // Ignore parse error
      }
      return null;
    }
  }
}
