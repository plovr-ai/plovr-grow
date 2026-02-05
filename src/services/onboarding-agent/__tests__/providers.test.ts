import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MockAIProvider } from "../providers/mock.provider";
import {
  getAIProvider,
  resetAIProvider,
} from "../providers";

describe("AI Providers", () => {
  beforeEach(() => {
    resetAIProvider();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("MockAIProvider", () => {
    const provider = new MockAIProvider();

    it("should return mock restaurant info", async () => {
      const result = await provider.extractRestaurantInfo("test content", "website");

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe("Mock Restaurant");
      expect(result.data?.address).toBe("123 Main Street");
      expect(result.data?.businessHours).toBeDefined();
    });

    it("should return mock menu categories", async () => {
      const result = await provider.extractMenu("test content", "website");

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.categories).toHaveLength(3);

      const appetizers = result.data?.categories.find(
        (c) => c.name === "Appetizers"
      );
      expect(appetizers).toBeDefined();
      expect(appetizers?.items.length).toBeGreaterThan(0);
    });

    it("should report as configured", () => {
      expect(provider.isConfigured()).toBe(true);
      expect(provider.getProviderName()).toBe("mock");
    });
  });

  describe("getAIProvider factory", () => {
    it("should return mock provider by default", () => {
      const provider = getAIProvider();
      expect(provider.getProviderName()).toBe("mock");
    });

    it("should return same instance on subsequent calls", () => {
      const provider1 = getAIProvider();
      const provider2 = getAIProvider();
      expect(provider1).toBe(provider2);
    });

    it("should return claude provider when AI_PROVIDER=claude", () => {
      vi.stubEnv("AI_PROVIDER", "claude");
      resetAIProvider();

      const provider = getAIProvider();
      expect(provider.getProviderName()).toContain("claude");
    });

    it("should return openai provider when AI_PROVIDER=openai", () => {
      vi.stubEnv("AI_PROVIDER", "openai");
      resetAIProvider();

      const provider = getAIProvider();
      expect(provider.getProviderName()).toContain("openai");
    });
  });
});
