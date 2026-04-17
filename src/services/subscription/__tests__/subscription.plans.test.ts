import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const originalEnv = process.env;

describe("subscription.plans", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("PRODUCT_LINES", () => {
    it("should include platform and phone_ai", async () => {
      const { PRODUCT_LINES } = await import("../subscription.types");
      expect(PRODUCT_LINES).toContain("platform");
      expect(PRODUCT_LINES).toContain("phone_ai");
    });
  });

  describe("PLAN_DEFINITIONS", () => {
    it("should organize plans by product line", async () => {
      const { PLAN_DEFINITIONS } = await import("../subscription.plans");
      expect(PLAN_DEFINITIONS.platform).toBeDefined();
      expect(PLAN_DEFINITIONS.phone_ai).toBeDefined();
    });

    it("should define starter, pro, and enterprise for platform", async () => {
      const { PLAN_DEFINITIONS } = await import("../subscription.plans");
      expect(PLAN_DEFINITIONS.platform.starter).toBeDefined();
      expect(PLAN_DEFINITIONS.platform.pro).toBeDefined();
      expect(PLAN_DEFINITIONS.platform.enterprise).toBeDefined();
    });

    it("should have correct platform starter plan details", async () => {
      const { PLAN_DEFINITIONS } = await import("../subscription.plans");
      expect(PLAN_DEFINITIONS.platform.starter).toEqual({
        name: "Starter",
        code: "starter",
        monthlyPrice: 49,
        currency: "USD",
        tier: 1,
        features: [
          "Online ordering",
          "Menu management",
          "Order management",
          "1 location",
        ],
        stripePriceEnvKey: "STRIPE_PLATFORM_STARTER_PRICE_ID",
      });
    });

    it("should have empty phone_ai plans for now", async () => {
      const { PLAN_DEFINITIONS } = await import("../subscription.plans");
      expect(Object.keys(PLAN_DEFINITIONS.phone_ai)).toHaveLength(0);
    });
  });

  describe("getPlanByCode", () => {
    it("should return a plan for a valid productLine and code", async () => {
      const { getPlanByCode } = await import("../subscription.plans");
      const plan = getPlanByCode("platform", "starter");
      expect(plan).toBeDefined();
      expect(plan?.code).toBe("starter");
    });

    it("should return undefined for invalid code", async () => {
      const { getPlanByCode } = await import("../subscription.plans");
      expect(getPlanByCode("platform", "nonexistent")).toBeUndefined();
    });

    it("should return undefined for invalid productLine", async () => {
      const { getPlanByCode } = await import("../subscription.plans");
      expect(getPlanByCode("nonexistent" as "platform", "starter")).toBeUndefined();
    });
  });

  describe("getStripePriceId", () => {
    it("should return the env value for a valid plan", async () => {
      process.env.STRIPE_PLATFORM_STARTER_PRICE_ID = "price_starter_123";
      const { getStripePriceId } = await import("../subscription.plans");
      expect(getStripePriceId("platform", "starter")).toBe("price_starter_123");
    });

    it("should return undefined when env var is not set", async () => {
      delete process.env.STRIPE_PLATFORM_STARTER_PRICE_ID;
      const { getStripePriceId } = await import("../subscription.plans");
      expect(getStripePriceId("platform", "starter")).toBeUndefined();
    });

    it("should return undefined for invalid plan code", async () => {
      const { getStripePriceId } = await import("../subscription.plans");
      expect(getStripePriceId("platform", "nonexistent")).toBeUndefined();
    });
  });

  describe("getPlanByStripePriceId", () => {
    it("should return productLine and plan for a known price id", async () => {
      process.env.STRIPE_PLATFORM_STARTER_PRICE_ID = "price_starter_abc";
      process.env.STRIPE_PLATFORM_PRO_PRICE_ID = "price_pro_abc";
      process.env.STRIPE_PLATFORM_ENTERPRISE_PRICE_ID = "price_enterprise_abc";

      const { getPlanByStripePriceId } = await import("../subscription.plans");
      const result = getPlanByStripePriceId("price_pro_abc");
      expect(result).toBeDefined();
      expect(result?.productLine).toBe("platform");
      expect(result?.plan.code).toBe("pro");
    });

    it("should return undefined when no plan matches", async () => {
      process.env.STRIPE_PLATFORM_STARTER_PRICE_ID = "price_starter_abc";
      const { getPlanByStripePriceId } = await import("../subscription.plans");
      expect(getPlanByStripePriceId("price_unknown")).toBeUndefined();
    });
  });

  describe("getAllPlans", () => {
    it("should return all plans for a given product line", async () => {
      const { getAllPlans } = await import("../subscription.plans");
      const plans = getAllPlans("platform");
      expect(plans).toHaveLength(3);
      expect(plans[0].code).toBe("starter");
      expect(plans[1].code).toBe("pro");
      expect(plans[2].code).toBe("enterprise");
    });

    it("should return empty array for product line with no plans", async () => {
      const { getAllPlans } = await import("../subscription.plans");
      const plans = getAllPlans("phone_ai");
      expect(plans).toHaveLength(0);
    });
  });

  describe("getPlanTier", () => {
    it("should return correct tier for platform plans", async () => {
      const { getPlanTier } = await import("../subscription.plans");
      expect(getPlanTier("platform", "free")).toBe(0);
      expect(getPlanTier("platform", "starter")).toBe(1);
      expect(getPlanTier("platform", "pro")).toBe(2);
      expect(getPlanTier("platform", "enterprise")).toBe(3);
    });

    it("should return 0 for unknown plan codes", async () => {
      const { getPlanTier } = await import("../subscription.plans");
      expect(getPlanTier("platform", "nonexistent")).toBe(0);
    });
  });
});
