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

  describe("PLAN_DEFINITIONS", () => {
    it("should define starter, pro, and enterprise plans", async () => {
      const { PLAN_DEFINITIONS } = await import("../subscription.plans");

      expect(PLAN_DEFINITIONS.starter).toBeDefined();
      expect(PLAN_DEFINITIONS.pro).toBeDefined();
      expect(PLAN_DEFINITIONS.enterprise).toBeDefined();
    });

    it("should have correct starter plan details", async () => {
      const { PLAN_DEFINITIONS } = await import("../subscription.plans");

      expect(PLAN_DEFINITIONS.starter).toEqual({
        name: "Starter",
        code: "starter",
        monthlyPrice: 49,
        currency: "USD",
        features: [
          "Online ordering",
          "Menu management",
          "Order management",
          "1 location",
        ],
        stripePriceEnvKey: "STRIPE_STARTER_PRICE_ID",
      });
    });

    it("should have correct pro plan details", async () => {
      const { PLAN_DEFINITIONS } = await import("../subscription.plans");

      expect(PLAN_DEFINITIONS.pro).toEqual({
        name: "Pro",
        code: "pro",
        monthlyPrice: 99,
        currency: "USD",
        features: [
          "Everything in Starter",
          "Loyalty program",
          "Gift cards",
          "Catering",
          "Up to 3 locations",
        ],
        stripePriceEnvKey: "STRIPE_PRO_PRICE_ID",
      });
    });

    it("should have correct enterprise plan details", async () => {
      const { PLAN_DEFINITIONS } = await import("../subscription.plans");

      expect(PLAN_DEFINITIONS.enterprise).toEqual({
        name: "Enterprise",
        code: "enterprise",
        monthlyPrice: 199,
        currency: "USD",
        features: [
          "Everything in Pro",
          "Analytics & reporting",
          "Priority support",
          "Unlimited locations",
        ],
        stripePriceEnvKey: "STRIPE_ENTERPRISE_PRICE_ID",
      });
    });
  });

  describe("getPlanByCode", () => {
    it("should return a plan for a valid code", async () => {
      const { getPlanByCode } = await import("../subscription.plans");

      const plan = getPlanByCode("starter");
      expect(plan).toBeDefined();
      expect(plan?.code).toBe("starter");
    });

    it("should return undefined for an invalid code", async () => {
      const { getPlanByCode } = await import("../subscription.plans");

      expect(getPlanByCode("nonexistent")).toBeUndefined();
    });

    it("should return each plan by its code", async () => {
      const { getPlanByCode } = await import("../subscription.plans");

      expect(getPlanByCode("starter")?.name).toBe("Starter");
      expect(getPlanByCode("pro")?.name).toBe("Pro");
      expect(getPlanByCode("enterprise")?.name).toBe("Enterprise");
    });
  });

  describe("getStripePriceId", () => {
    it("should return the env value for a valid plan code", async () => {
      process.env.STRIPE_STARTER_PRICE_ID = "price_starter_123";

      const { getStripePriceId } = await import("../subscription.plans");

      expect(getStripePriceId("starter")).toBe("price_starter_123");
    });

    it("should return undefined when env var is not set", async () => {
      delete process.env.STRIPE_STARTER_PRICE_ID;

      const { getStripePriceId } = await import("../subscription.plans");

      expect(getStripePriceId("starter")).toBeUndefined();
    });

    it("should return undefined for an invalid plan code", async () => {
      const { getStripePriceId } = await import("../subscription.plans");

      expect(getStripePriceId("nonexistent")).toBeUndefined();
    });

    it("should read from the correct env key per plan", async () => {
      process.env.STRIPE_STARTER_PRICE_ID = "price_s";
      process.env.STRIPE_PRO_PRICE_ID = "price_p";
      process.env.STRIPE_ENTERPRISE_PRICE_ID = "price_e";

      const { getStripePriceId } = await import("../subscription.plans");

      expect(getStripePriceId("starter")).toBe("price_s");
      expect(getStripePriceId("pro")).toBe("price_p");
      expect(getStripePriceId("enterprise")).toBe("price_e");
    });
  });

  describe("getPlanByStripePriceId", () => {
    it("should return the matching plan for a known stripe price id", async () => {
      process.env.STRIPE_STARTER_PRICE_ID = "price_starter_abc";
      process.env.STRIPE_PRO_PRICE_ID = "price_pro_abc";
      process.env.STRIPE_ENTERPRISE_PRICE_ID = "price_enterprise_abc";

      const { getPlanByStripePriceId } = await import(
        "../subscription.plans"
      );

      const plan = getPlanByStripePriceId("price_pro_abc");
      expect(plan).toBeDefined();
      expect(plan?.code).toBe("pro");
    });

    it("should return undefined when no plan matches", async () => {
      process.env.STRIPE_STARTER_PRICE_ID = "price_starter_abc";

      const { getPlanByStripePriceId } = await import(
        "../subscription.plans"
      );

      expect(getPlanByStripePriceId("price_unknown")).toBeUndefined();
    });

    it("should return undefined when no env vars are set", async () => {
      delete process.env.STRIPE_STARTER_PRICE_ID;
      delete process.env.STRIPE_PRO_PRICE_ID;
      delete process.env.STRIPE_ENTERPRISE_PRICE_ID;

      const { getPlanByStripePriceId } = await import(
        "../subscription.plans"
      );

      expect(getPlanByStripePriceId("price_anything")).toBeUndefined();
    });
  });

  describe("getAllPlans", () => {
    it("should return all three plans in order", async () => {
      const { getAllPlans } = await import("../subscription.plans");

      const plans = getAllPlans();
      expect(plans).toHaveLength(3);
      expect(plans[0].code).toBe("starter");
      expect(plans[1].code).toBe("pro");
      expect(plans[2].code).toBe("enterprise");
    });
  });

  describe("getPlanTier", () => {
    it("should return 0 for free", async () => {
      const { getPlanTier } = await import("../subscription.plans");
      expect(getPlanTier("free")).toBe(0);
    });

    it("should return 1 for starter", async () => {
      const { getPlanTier } = await import("../subscription.plans");
      expect(getPlanTier("starter")).toBe(1);
    });

    it("should return 2 for pro", async () => {
      const { getPlanTier } = await import("../subscription.plans");
      expect(getPlanTier("pro")).toBe(2);
    });

    it("should return 3 for enterprise", async () => {
      const { getPlanTier } = await import("../subscription.plans");
      expect(getPlanTier("enterprise")).toBe(3);
    });

    it("should return 0 for unknown plan codes", async () => {
      const { getPlanTier } = await import("../subscription.plans");
      expect(getPlanTier("nonexistent")).toBe(0);
    });
  });
});
