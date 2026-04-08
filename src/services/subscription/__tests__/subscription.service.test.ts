import { describe, it, expect, vi, beforeEach } from "vitest";

// Set env vars before importing
process.env.STRIPE_STARTER_PRICE_ID = "price_starter_test";
process.env.STRIPE_PRO_PRICE_ID = "price_pro_test";
process.env.STRIPE_ENTERPRISE_PRICE_ID = "price_enterprise_test";
process.env.STRIPE_TRIAL_DAYS = "14";
process.env.STRIPE_GRACE_PERIOD_DAYS = "7";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

vi.mock("@/services/stripe/stripe.service", () => ({
  stripeService: {
    createSubscriptionCheckoutSession: vi.fn(),
    createCustomer: vi.fn(),
    updateSubscriptionPrice: vi.fn(),
    getSubscription: vi.fn(),
  },
}));

vi.mock("@/repositories/subscription.repository", () => ({
  subscriptionRepository: {
    getByTenantId: vi.fn(),
    getByStripeSubscriptionId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateByTenantId: vi.fn(),
    updateTenantSubscriptionStatus: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  default: {
    tenant: { findUnique: vi.fn() },
  },
}));

import { subscriptionService } from "../subscription.service";
import { stripeService } from "@/services/stripe/stripe.service";
import { subscriptionRepository } from "@/repositories/subscription.repository";

const activeSubscription = {
  id: "sub-1",
  tenantId: "tenant-1",
  stripeCustomerId: "cus_123",
  stripeSubscriptionId: "sub_stripe_123",
  stripePriceId: "price_starter_test",
  status: "active",
  plan: "starter",
  currentPeriodStart: new Date(),
  currentPeriodEnd: new Date(),
  trialStart: null,
  trialEnd: null,
  cancelAtPeriodEnd: false,
  canceledAt: null,
  gracePeriodEnd: null,
  deleted: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("SubscriptionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createCheckoutSession", () => {
    it("should use correct Stripe price ID for given plan code", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue(
        activeSubscription
      );
      vi.mocked(
        stripeService.createSubscriptionCheckoutSession
      ).mockResolvedValue({
        url: "https://checkout.stripe.com/session_123",
        sessionId: "cs_123",
      });

      const result = await subscriptionService.createCheckoutSession(
        "tenant-1",
        "starter"
      );

      expect(
        stripeService.createSubscriptionCheckoutSession
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          priceId: "price_starter_test",
          customerId: "cus_123",
          tenantId: "tenant-1",
          trialDays: 14,
        })
      );
      expect(result.url).toBe("https://checkout.stripe.com/session_123");
      expect(result.sessionId).toBe("cs_123");
    });

    it("should throw on invalid plan code", async () => {
      await expect(
        subscriptionService.createCheckoutSession("tenant-1", "nonexistent")
      ).rejects.toThrow("Invalid plan code: nonexistent");
    });

    it("should throw when env var is not configured", async () => {
      const original = process.env.STRIPE_STARTER_PRICE_ID;
      delete process.env.STRIPE_STARTER_PRICE_ID;

      await expect(
        subscriptionService.createCheckoutSession("tenant-1", "starter")
      ).rejects.toThrow("Stripe price ID not configured for plan: starter");

      process.env.STRIPE_STARTER_PRICE_ID = original;
    });
  });

  describe("changePlan", () => {
    it("should upgrade from starter to pro", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue(
        activeSubscription
      );
      vi.mocked(stripeService.updateSubscriptionPrice).mockResolvedValue({
        id: "sub_stripe_123",
        customerId: "cus_123",
        status: "active",
        priceId: "price_pro_test",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        canceledAt: null,
        trialStart: null,
        trialEnd: null,
      });

      await subscriptionService.changePlan("tenant-1", "pro");

      expect(stripeService.updateSubscriptionPrice).toHaveBeenCalledWith({
        subscriptionId: "sub_stripe_123",
        currentPriceId: "price_starter_test",
        newPriceId: "price_pro_test",
      });
      expect(subscriptionRepository.update).toHaveBeenCalledWith("sub-1", {
        plan: "pro",
        stripePriceId: "price_pro_test",
      });
      expect(
        subscriptionRepository.updateTenantSubscriptionStatus
      ).toHaveBeenCalledWith("tenant-1", "pro", "active");
    });

    it("should throw when no subscription exists", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue(null);

      await expect(
        subscriptionService.changePlan("tenant-1", "pro")
      ).rejects.toThrow("No active subscription found");
    });

    it("should throw when subscription is canceled", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue({
        ...activeSubscription,
        status: "canceled",
      });

      await expect(
        subscriptionService.changePlan("tenant-1", "pro")
      ).rejects.toThrow("Subscription is not active");
    });

    it("should throw when already on the same plan", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue(
        activeSubscription
      );

      await expect(
        subscriptionService.changePlan("tenant-1", "starter")
      ).rejects.toThrow("Already on this plan");
    });

    it("should throw when Stripe update fails", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue(
        activeSubscription
      );
      vi.mocked(stripeService.updateSubscriptionPrice).mockResolvedValue(null);

      await expect(
        subscriptionService.changePlan("tenant-1", "pro")
      ).rejects.toThrow("Failed to update subscription in Stripe");
    });
  });
});
