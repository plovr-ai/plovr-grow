/**
 * AI Provider Factory
 *
 * Creates the appropriate AI provider based on environment configuration.
 */

import type { AIProvider } from "./ai-provider.interface";
import { ClaudeProvider } from "./claude.provider";
import { OpenAIProvider } from "./openai.provider";
import { MockAIProvider } from "./mock.provider";

export type { AIProvider } from "./ai-provider.interface";
export { ClaudeProvider } from "./claude.provider";
export { OpenAIProvider } from "./openai.provider";
export { MockAIProvider } from "./mock.provider";

/**
 * Create AI provider based on environment configuration
 *
 * Uses AI_PROVIDER env var to select provider:
 * - "claude" or "anthropic" -> ClaudeProvider
 * - "openai" -> OpenAIProvider
 * - "mock" or default -> MockAIProvider
 */
function createAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER ?? "mock";

  switch (provider.toLowerCase()) {
    case "claude":
    case "anthropic":
      return new ClaudeProvider();
    case "openai":
      return new OpenAIProvider();
    case "mock":
    default:
      return new MockAIProvider();
  }
}

// Singleton instance
let aiProviderInstance: AIProvider | null = null;

/**
 * Get the AI provider instance (singleton)
 */
export function getAIProvider(): AIProvider {
  if (!aiProviderInstance) {
    aiProviderInstance = createAIProvider();
    console.log(
      `[OnboardingAgent] Using AI provider: ${aiProviderInstance.getProviderName()}`
    );
  }
  return aiProviderInstance;
}

/**
 * Reset AI provider instance (for testing)
 */
export function resetAIProvider(): void {
  aiProviderInstance = null;
}
