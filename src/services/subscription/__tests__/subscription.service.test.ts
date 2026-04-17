import { describe, it, expect, vi, beforeEach } from "vitest";

// Set env vars before importing
process.env.STRIPE_PLATFORM_STARTER_PRICE_ID = "price_starter_test";
process.env.STRIPE_PLATFORM_PRO_PRICE_ID = "price_pro_test";
process.env.STRIPE_PLATFORM_ENTERPRISE_PRICE_ID = "price_enterprise_test";
process.env.STRIPE_TRIAL_DAYS = "14";
process.env.STRIPE_GRACE_PERIOD_DAYS = "7";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

vi.mock("@/services/stripe/stripe.service", () => ({
  stripeService: {
    createSubscriptionCheckoutSession: vi.fn(),
    createBillingPortalSession: vi.fn(),
    createCustomer: vi.fn(),
    cancelSubscription: vi.fn(),
    resumeSubscription: vi.fn(),
    updateSubscriptionPrice: vi.fn(),
    getSubscription: vi.fn(),
  },
}));

vi.mock("@/repositories/subscription.repository", () => ({
  subscriptionRepository: {
    getByTenantId: vi.fn(),
    getAllByTenantId: vi.fn(),
    getByStripeSubscriptionId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateByTenantId: vi.fn(),
  },
}));

vi.mock("@/repositories/tenant.repository", () => ({
  tenantRepository: {
    getNameAndSupportEmail: vi.fn(),
  },
}));

import { subscriptionService } from "../subscription.service";
import { stripeService } from "@/services/stripe/stripe.service";
import { subscriptionRepository } from "@/repositories/subscription.repository";
import { tenantRepository } from "@/repositories/tenant.repository";

const activeSubscription = {
  id: "sub-1",
  tenantId: "tenant-1",
  productLine: "platform",
  stripeCustomerId: "cus_123",
  stripeSubscriptionId: "sub_stripe_123",
  stripePriceId: "price_starter_test",
  status: "active",
  plan: "starter",
  currentPeriodStart: new Date("2026-01-01"),
  currentPeriodEnd: new Date("2026-02-01"),
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

  // ==================== Read Operations ====================

  describe("getSubscription", () => {
    it("should return null when no subscription exists", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue(null);

      const result = await subscriptionService.getSubscription("tenant-1", "platform");
      expect(result).toBeNull();
    });

    it("should return subscription info for active subscription", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue(activeSubscription);

      const result = await subscriptionService.getSubscription("tenant-1", "platform");
      expect(result).not.toBeNull();
      expect(result!.id).toBe("sub-1");
      expect(result!.status).toBe("active");
      expect(result!.plan).toBe("starter");
      expect(result!.productLine).toBe("platform");
      expect(result!.canAccessPremiumFeatures).toBe(true);
      expect(result!.isInGracePeriod).toBe(false);
      expect(result!.trialDaysRemaining).toBeNull();
    });

    it("should calculate trial days remaining for trialing subscription", async () => {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 5); // 5 days from now

      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue({
        ...activeSubscription,
        status: "trialing",
        trialEnd,
      });

      const result = await subscriptionService.getSubscription("tenant-1", "platform");
      expect(result!.status).toBe("trialing");
      expect(result!.trialDaysRemaining).toBeGreaterThanOrEqual(4);
      expect(result!.trialDaysRemaining).toBeLessThanOrEqual(6);
      expect(result!.canAccessPremiumFeatures).toBe(true);
    });

    it("should return 0 trial days remaining when trial has ended", async () => {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() - 1); // 1 day ago

      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue({
        ...activeSubscription,
        status: "trialing",
        trialEnd,
      });

      const result = await subscriptionService.getSubscription("tenant-1", "platform");
      expect(result!.trialDaysRemaining).toBe(0);
    });

    it("should return null trial days when not trialing", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue(activeSubscription);

      const result = await subscriptionService.getSubscription("tenant-1", "platform");
      expect(result!.trialDaysRemaining).toBeNull();
    });

    it("should calculate grace period correctly for past_due with future grace period", async () => {
      const gracePeriodEnd = new Date();
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 3);

      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue({
        ...activeSubscription,
        status: "past_due",
        gracePeriodEnd,
      });

      const result = await subscriptionService.getSubscription("tenant-1", "platform");
      expect(result!.isInGracePeriod).toBe(true);
      expect(result!.canAccessPremiumFeatures).toBe(true);
    });

    it("should not be in grace period when grace period has ended", async () => {
      const gracePeriodEnd = new Date();
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() - 1);

      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue({
        ...activeSubscription,
        status: "past_due",
        gracePeriodEnd,
      });

      const result = await subscriptionService.getSubscription("tenant-1", "platform");
      expect(result!.isInGracePeriod).toBe(false);
      expect(result!.canAccessPremiumFeatures).toBe(false);
    });

    it("should not be in grace period when past_due but no gracePeriodEnd set", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue({
        ...activeSubscription,
        status: "past_due",
        gracePeriodEnd: null,
      });

      const result = await subscriptionService.getSubscription("tenant-1", "platform");
      expect(result!.isInGracePeriod).toBe(false);
      expect(result!.canAccessPremiumFeatures).toBe(false);
    });

    it("should not have premium access for canceled subscription", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue({
        ...activeSubscription,
        status: "canceled",
      });

      const result = await subscriptionService.getSubscription("tenant-1", "platform");
      expect(result!.canAccessPremiumFeatures).toBe(false);
    });
  });

  describe("getSubscriptionForDashboard", () => {
    it("should return null when no subscription exists", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue(null);

      const result = await subscriptionService.getSubscriptionForDashboard("tenant-1", "platform");
      expect(result).toBeNull();
    });

    it("should return dashboard subscription info for active subscription", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue(activeSubscription);

      const result = await subscriptionService.getSubscriptionForDashboard("tenant-1", "platform");
      expect(result).not.toBeNull();
      expect(result!.status).toBe("active");
      expect(result!.plan).toBe("starter");
      expect(result!.canAccessPremiumFeatures).toBe(true);
      expect(result!.isTrialing).toBe(false);
      expect(result!.trialDaysRemaining).toBeNull();
      expect(result!.cancelAtPeriodEnd).toBe(false);
      expect(result!.currentPeriodEnd).toEqual(activeSubscription.currentPeriodEnd);
    });

    it("should mark as trialing when status is trialing", async () => {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 10);

      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue({
        ...activeSubscription,
        status: "trialing",
        trialEnd,
      });

      const result = await subscriptionService.getSubscriptionForDashboard("tenant-1", "platform");
      expect(result!.isTrialing).toBe(true);
      expect(result!.trialDaysRemaining).toBeGreaterThan(0);
    });
  });

  describe("getAllSubscriptions", () => {
    it("should return empty array when tenant has no subscriptions", async () => {
      vi.mocked(subscriptionRepository.getAllByTenantId).mockResolvedValue([]);

      const result = await subscriptionService.getAllSubscriptions("tenant-1");
      expect(result).toEqual([]);
      expect(subscriptionRepository.getAllByTenantId).toHaveBeenCalledWith("tenant-1");
    });

    it("should return SubscriptionInfo list for all product lines", async () => {
      const phoneAiSubscription = {
        ...activeSubscription,
        id: "sub-2",
        productLine: "phone_ai",
        stripeSubscriptionId: "sub_stripe_456",
      };
      vi.mocked(subscriptionRepository.getAllByTenantId).mockResolvedValue([
        activeSubscription,
        phoneAiSubscription,
      ]);

      const result = await subscriptionService.getAllSubscriptions("tenant-1");
      expect(result).toHaveLength(2);
      expect(result[0].productLine).toBe("platform");
      expect(result[1].productLine).toBe("phone_ai");
    });
  });

  describe("isSubscriptionActive", () => {
    it("should return false when no subscription", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue(null);

      const result = await subscriptionService.isSubscriptionActive("tenant-1", "platform");
      expect(result).toBe(false);
    });

    it("should return true for active subscription", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue(activeSubscription);

      const result = await subscriptionService.isSubscriptionActive("tenant-1", "platform");
      expect(result).toBe(true);
    });

    it("should return true for trialing subscription", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue({
        ...activeSubscription,
        status: "trialing",
      });

      const result = await subscriptionService.isSubscriptionActive("tenant-1", "platform");
      expect(result).toBe(true);
    });

    it("should return false for past_due subscription", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue({
        ...activeSubscription,
        status: "past_due",
      });

      const result = await subscriptionService.isSubscriptionActive("tenant-1", "platform");
      expect(result).toBe(false);
    });

    it("should return false for canceled subscription", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue({
        ...activeSubscription,
        status: "canceled",
      });

      const result = await subscriptionService.isSubscriptionActive("tenant-1", "platform");
      expect(result).toBe(false);
    });
  });

  describe("canAccessPremiumFeatures", () => {
    it("should return false when no subscription", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue(null);

      const result = await subscriptionService.canAccessPremiumFeatures("tenant-1", "platform");
      expect(result).toBe(false);
    });

    it("should return true for active subscription", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue(activeSubscription);

      const result = await subscriptionService.canAccessPremiumFeatures("tenant-1", "platform");
      expect(result).toBe(true);
    });

    it("should return true for trialing subscription", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue({
        ...activeSubscription,
        status: "trialing",
      });

      const result = await subscriptionService.canAccessPremiumFeatures("tenant-1", "platform");
      expect(result).toBe(true);
    });

    it("should return true for past_due within grace period", async () => {
      const gracePeriodEnd = new Date();
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 5);

      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue({
        ...activeSubscription,
        status: "past_due",
        gracePeriodEnd,
      });

      const result = await subscriptionService.canAccessPremiumFeatures("tenant-1", "platform");
      expect(result).toBe(true);
    });

    it("should return false for past_due after grace period", async () => {
      const gracePeriodEnd = new Date();
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() - 1);

      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue({
        ...activeSubscription,
        status: "past_due",
        gracePeriodEnd,
      });

      const result = await subscriptionService.canAccessPremiumFeatures("tenant-1", "platform");
      expect(result).toBe(false);
    });

    it("should return false for past_due with no grace period", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue({
        ...activeSubscription,
        status: "past_due",
        gracePeriodEnd: null,
      });

      const result = await subscriptionService.canAccessPremiumFeatures("tenant-1", "platform");
      expect(result).toBe(false);
    });

    it("should return false for canceled subscription", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue({
        ...activeSubscription,
        status: "canceled",
      });

      const result = await subscriptionService.canAccessPremiumFeatures("tenant-1", "platform");
      expect(result).toBe(false);
    });
  });

  // ==================== Subscription Management ====================

  describe("createCheckoutSession", () => {
    it("should use correct Stripe price ID for given plan code", async () => {
      vi.mocked(subscriptionRepository.getAllByTenantId).mockResolvedValue([activeSubscription]);
      vi.mocked(stripeService.createSubscriptionCheckoutSession).mockResolvedValue({
        url: "https://checkout.stripe.com/session_123",
        sessionId: "cs_123",
      });

      const result = await subscriptionService.createCheckoutSession("tenant-1", "platform", "starter");

      expect(stripeService.createSubscriptionCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          priceId: "price_starter_test",
          customerId: "cus_123",
          tenantId: "tenant-1",
          trialDays: 14,
          metadata: { productLine: "platform" },
        })
      );
      expect(result.url).toBe("https://checkout.stripe.com/session_123");
      expect(result.sessionId).toBe("cs_123");
    });

    it("should throw on invalid plan code", async () => {
      await expect(
        subscriptionService.createCheckoutSession("tenant-1", "platform", "nonexistent")
      ).rejects.toThrow("INVALID_PLAN_CODE");
    });

    it("should throw when env var is not configured", async () => {
      const original = process.env.STRIPE_PLATFORM_STARTER_PRICE_ID;
      delete process.env.STRIPE_PLATFORM_STARTER_PRICE_ID;

      await expect(
        subscriptionService.createCheckoutSession("tenant-1", "platform", "starter")
      ).rejects.toThrow("STRIPE_PRICE_NOT_CONFIGURED");

      process.env.STRIPE_PLATFORM_STARTER_PRICE_ID = original;
    });

    it("should use custom success and cancel URLs when provided", async () => {
      vi.mocked(subscriptionRepository.getAllByTenantId).mockResolvedValue([activeSubscription]);
      vi.mocked(stripeService.createSubscriptionCheckoutSession).mockResolvedValue({
        url: "https://checkout.stripe.com/session_456",
        sessionId: "cs_456",
      });

      await subscriptionService.createCheckoutSession("tenant-1", "platform", "pro", {
        successUrl: "http://custom.com/success",
        cancelUrl: "http://custom.com/cancel",
      });

      expect(stripeService.createSubscriptionCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          successUrl: "http://custom.com/success",
          cancelUrl: "http://custom.com/cancel",
        })
      );
    });

    it("should use default URLs when no options provided", async () => {
      vi.mocked(subscriptionRepository.getAllByTenantId).mockResolvedValue([activeSubscription]);
      vi.mocked(stripeService.createSubscriptionCheckoutSession).mockResolvedValue({
        url: "https://checkout.stripe.com/session_789",
        sessionId: "cs_789",
      });

      await subscriptionService.createCheckoutSession("tenant-1", "platform", "pro");

      expect(stripeService.createSubscriptionCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          successUrl: "http://localhost:3000/dashboard/subscription?success=true",
          cancelUrl: "http://localhost:3000/dashboard/subscription?canceled=true",
        })
      );
    });

    it("should create a new Stripe customer when no existing subscription", async () => {
      vi.mocked(subscriptionRepository.getAllByTenantId).mockResolvedValue([]);
      vi.mocked(tenantRepository.getNameAndSupportEmail).mockResolvedValue({
        name: "Test Tenant",
        supportEmail: "support@test.com",
      } as never);
      vi.mocked(stripeService.createCustomer).mockResolvedValue("cus_new_123");
      vi.mocked(subscriptionRepository.create).mockResolvedValue({} as never);
      vi.mocked(stripeService.createSubscriptionCheckoutSession).mockResolvedValue({
        url: "https://checkout.stripe.com/session_new",
        sessionId: "cs_new",
      });

      await subscriptionService.createCheckoutSession("tenant-1", "platform", "starter");

      expect(stripeService.createCustomer).toHaveBeenCalledWith({
        email: "support@test.com",
        name: "Test Tenant",
        metadata: { tenantId: "tenant-1" },
      });
      expect(subscriptionRepository.create).toHaveBeenCalledWith("tenant-1", "platform", {
        stripeCustomerId: "cus_new_123",
        status: "incomplete",
      });
    });

    it("should use fallback email when tenant has no company email", async () => {
      vi.mocked(subscriptionRepository.getAllByTenantId).mockResolvedValue([]);
      vi.mocked(tenantRepository.getNameAndSupportEmail).mockResolvedValue({
        name: "Test Tenant",
        supportEmail: null,
      } as never);
      vi.mocked(stripeService.createCustomer).mockResolvedValue("cus_new_456");
      vi.mocked(subscriptionRepository.create).mockResolvedValue({} as never);
      vi.mocked(stripeService.createSubscriptionCheckoutSession).mockResolvedValue({
        url: "https://checkout.stripe.com/session_fb",
        sessionId: "cs_fb",
      });

      await subscriptionService.createCheckoutSession("tenant-1", "platform", "starter");

      expect(stripeService.createCustomer).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "tenant-tenant-1@plovr.app",
        })
      );
    });

    it("should throw when tenant not found during customer creation", async () => {
      vi.mocked(subscriptionRepository.getAllByTenantId).mockResolvedValue([]);
      vi.mocked(tenantRepository.getNameAndSupportEmail).mockResolvedValue(null);

      await expect(
        subscriptionService.createCheckoutSession("tenant-1", "platform", "starter")
      ).rejects.toThrow("TENANT_NOT_FOUND");
    });
  });

  describe("createBillingPortalSession", () => {
    it("should create billing portal session with default return URL", async () => {
      vi.mocked(subscriptionRepository.getAllByTenantId).mockResolvedValue([activeSubscription]);
      vi.mocked(stripeService.createBillingPortalSession).mockResolvedValue({
        url: "https://billing.stripe.com/portal_123",
      });

      const result = await subscriptionService.createBillingPortalSession("tenant-1");

      expect(stripeService.createBillingPortalSession).toHaveBeenCalledWith({
        customerId: "cus_123",
        returnUrl: "http://localhost:3000/dashboard/subscription",
      });
      expect(result.url).toBe("https://billing.stripe.com/portal_123");
    });

    it("should create billing portal session with custom return URL", async () => {
      vi.mocked(subscriptionRepository.getAllByTenantId).mockResolvedValue([activeSubscription]);
      vi.mocked(stripeService.createBillingPortalSession).mockResolvedValue({
        url: "https://billing.stripe.com/portal_456",
      });

      await subscriptionService.createBillingPortalSession("tenant-1", "http://custom.com/return");

      expect(stripeService.createBillingPortalSession).toHaveBeenCalledWith({
        customerId: "cus_123",
        returnUrl: "http://custom.com/return",
      });
    });

    it("should throw when no subscription found", async () => {
      vi.mocked(subscriptionRepository.getAllByTenantId).mockResolvedValue([]);

      await expect(
        subscriptionService.createBillingPortalSession("tenant-1")
      ).rejects.toThrow("SUBSCRIPTION_NOT_FOUND");
    });
  });

  describe("cancelSubscription", () => {
    it("should cancel at period end by default", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue(activeSubscription);

      await subscriptionService.cancelSubscription("tenant-1", "platform");

      expect(stripeService.cancelSubscription).toHaveBeenCalledWith(
        "sub_stripe_123",
        true // cancelAtPeriodEnd
      );
      expect(subscriptionRepository.updateByTenantId).toHaveBeenCalledWith("tenant-1", "platform", {
        cancelAtPeriodEnd: true,
        canceledAt: null,
      });
    });

    it("should cancel immediately when flag is true", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue(activeSubscription);

      await subscriptionService.cancelSubscription("tenant-1", "platform", true);

      expect(stripeService.cancelSubscription).toHaveBeenCalledWith(
        "sub_stripe_123",
        false // cancelAtPeriodEnd = false for immediate
      );
      expect(subscriptionRepository.updateByTenantId).toHaveBeenCalledWith(
        "tenant-1",
        "platform",
        expect.objectContaining({
          cancelAtPeriodEnd: false,
          canceledAt: expect.any(Date),
        })
      );
    });

    it("should throw when no subscription found", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue(null);

      await expect(
        subscriptionService.cancelSubscription("tenant-1", "platform")
      ).rejects.toThrow("SUBSCRIPTION_NOT_FOUND");
    });

    it("should throw when subscription has no stripeSubscriptionId", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue({
        ...activeSubscription,
        stripeSubscriptionId: null,
      });

      await expect(
        subscriptionService.cancelSubscription("tenant-1", "platform")
      ).rejects.toThrow("SUBSCRIPTION_NOT_FOUND");
    });
  });

  describe("resumeSubscription", () => {
    it("should resume a canceled subscription", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue({
        ...activeSubscription,
        cancelAtPeriodEnd: true,
      });

      await subscriptionService.resumeSubscription("tenant-1", "platform");

      expect(stripeService.resumeSubscription).toHaveBeenCalledWith("sub_stripe_123");
      expect(subscriptionRepository.updateByTenantId).toHaveBeenCalledWith("tenant-1", "platform", {
        cancelAtPeriodEnd: false,
        canceledAt: null,
      });
    });

    it("should throw when no subscription found", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue(null);

      await expect(
        subscriptionService.resumeSubscription("tenant-1", "platform")
      ).rejects.toThrow("SUBSCRIPTION_NOT_FOUND");
    });

    it("should throw when subscription has no stripeSubscriptionId", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue({
        ...activeSubscription,
        stripeSubscriptionId: null,
      });

      await expect(
        subscriptionService.resumeSubscription("tenant-1", "platform")
      ).rejects.toThrow("SUBSCRIPTION_NOT_FOUND");
    });

    it("should throw when subscription is not scheduled for cancellation", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue(activeSubscription);

      await expect(
        subscriptionService.resumeSubscription("tenant-1", "platform")
      ).rejects.toThrow("SUBSCRIPTION_NOT_CANCELLING");
    });
  });

  describe("changePlan", () => {
    it("should upgrade from starter to pro", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue(activeSubscription);
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

      await subscriptionService.changePlan("tenant-1", "platform", "pro");

      expect(stripeService.updateSubscriptionPrice).toHaveBeenCalledWith({
        subscriptionId: "sub_stripe_123",
        currentPriceId: "price_starter_test",
        newPriceId: "price_pro_test",
      });
      expect(subscriptionRepository.update).toHaveBeenCalledWith("sub-1", {
        plan: "pro",
        stripePriceId: "price_pro_test",
      });
    });

    it("should throw when no subscription exists", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue(null);

      await expect(
        subscriptionService.changePlan("tenant-1", "platform", "pro")
      ).rejects.toThrow("SUBSCRIPTION_NOT_FOUND");
    });

    it("should throw when subscription is canceled", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue({
        ...activeSubscription,
        status: "canceled",
      });

      await expect(
        subscriptionService.changePlan("tenant-1", "platform", "pro")
      ).rejects.toThrow("SUBSCRIPTION_NOT_FOUND");
    });

    it("should throw when already on the same plan", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue(activeSubscription);

      await expect(
        subscriptionService.changePlan("tenant-1", "platform", "starter")
      ).rejects.toThrow("INVALID_PLAN_CODE");
    });

    it("should throw when Stripe update fails", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue(activeSubscription);
      vi.mocked(stripeService.updateSubscriptionPrice).mockResolvedValue(null);

      await expect(
        subscriptionService.changePlan("tenant-1", "platform", "pro")
      ).rejects.toThrow("INTERNAL_ERROR");
    });

    it("should throw for invalid plan code", async () => {
      await expect(
        subscriptionService.changePlan("tenant-1", "platform", "nonexistent")
      ).rejects.toThrow("INVALID_PLAN_CODE");
    });

    it("should throw when plan env var is not configured", async () => {
      const original = process.env.STRIPE_PLATFORM_PRO_PRICE_ID;
      delete process.env.STRIPE_PLATFORM_PRO_PRICE_ID;

      await expect(
        subscriptionService.changePlan("tenant-1", "platform", "pro")
      ).rejects.toThrow("STRIPE_PRICE_NOT_CONFIGURED");

      process.env.STRIPE_PLATFORM_PRO_PRICE_ID = original;
    });

    it("should throw when subscription has no stripePriceId", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue({
        ...activeSubscription,
        stripePriceId: null,
      });

      await expect(
        subscriptionService.changePlan("tenant-1", "platform", "pro")
      ).rejects.toThrow("STRIPE_PRICE_NOT_CONFIGURED");
    });

    it("should allow change for trialing subscription", async () => {
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue({
        ...activeSubscription,
        status: "trialing",
      });
      vi.mocked(stripeService.updateSubscriptionPrice).mockResolvedValue({
        id: "sub_stripe_123",
        customerId: "cus_123",
        status: "trialing",
        priceId: "price_pro_test",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        canceledAt: null,
        trialStart: null,
        trialEnd: null,
      });

      await subscriptionService.changePlan("tenant-1", "platform", "pro");

      expect(stripeService.updateSubscriptionPrice).toHaveBeenCalled();
    });
  });

  // ==================== Webhook Handlers ====================

  describe("handleCheckoutSessionCompleted", () => {
    const baseSession = {
      id: "cs_123",
      customer: "cus_123",
      subscription: "sub_stripe_123",
      mode: "subscription" as const,
      metadata: { tenantId: "tenant-1" },
    };

    it("should return early when tenantId missing from metadata", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await subscriptionService.handleCheckoutSessionCompleted({
        ...baseSession,
        metadata: {},
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("missing tenantId"),
        "cs_123"
      );
      expect(subscriptionRepository.getByTenantId).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should return early when mode is not subscription", async () => {
      await subscriptionService.handleCheckoutSessionCompleted({
        ...baseSession,
        mode: "payment",
      });

      expect(stripeService.getSubscription).not.toHaveBeenCalled();
    });

    it("should return early when subscription is null", async () => {
      await subscriptionService.handleCheckoutSessionCompleted({
        ...baseSession,
        subscription: null,
      });

      expect(stripeService.getSubscription).not.toHaveBeenCalled();
    });

    it("should return early when Stripe subscription fetch fails", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(stripeService.getSubscription).mockResolvedValue(null);

      await subscriptionService.handleCheckoutSessionCompleted(baseSession);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to fetch subscription"),
        "sub_stripe_123"
      );
      consoleSpy.mockRestore();
    });

    it("should update existing subscription on checkout complete", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const now = new Date();
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      vi.mocked(stripeService.getSubscription).mockResolvedValue({
        id: "sub_stripe_123",
        status: "active",
        customerId: "cus_123",
        priceId: "price_starter_test",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialStart: null,
        trialEnd: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      });
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue(activeSubscription);

      await subscriptionService.handleCheckoutSessionCompleted(baseSession);

      expect(subscriptionRepository.updateByTenantId).toHaveBeenCalledWith(
        "tenant-1",
        "platform",
        expect.objectContaining({
          stripeSubscriptionId: "sub_stripe_123",
          stripePriceId: "price_starter_test",
          plan: "starter",
          status: "active",
        })
      );
      consoleSpy.mockRestore();
    });

    it("should create new subscription when none exists on checkout complete", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const now = new Date();
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      vi.mocked(stripeService.getSubscription).mockResolvedValue({
        id: "sub_stripe_123",
        status: "trialing",
        customerId: "cus_123",
        priceId: "price_pro_test",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialStart: now,
        trialEnd: periodEnd,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      });
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue(null);

      await subscriptionService.handleCheckoutSessionCompleted(baseSession);

      expect(subscriptionRepository.create).toHaveBeenCalledWith(
        "tenant-1",
        "platform",
        expect.objectContaining({
          stripeCustomerId: "cus_123",
          stripeSubscriptionId: "sub_stripe_123",
          stripePriceId: "price_pro_test",
          status: "trialing",
          plan: "pro",
        })
      );
      consoleSpy.mockRestore();
    });

    it("should create subscription with null optional fields mapped to undefined", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      vi.mocked(stripeService.getSubscription).mockResolvedValue({
        id: "sub_stripe_123",
        status: "active",
        customerId: "cus_123",
        priceId: null,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        trialStart: null,
        trialEnd: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      });
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue(null);

      await subscriptionService.handleCheckoutSessionCompleted(baseSession);

      expect(subscriptionRepository.create).toHaveBeenCalledWith(
        "tenant-1",
        "platform",
        expect.objectContaining({
          stripePriceId: undefined,
          trialStart: undefined,
          trialEnd: undefined,
        })
      );
      consoleSpy.mockRestore();
    });

    it("should default to starter plan when priceId not found", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      vi.mocked(stripeService.getSubscription).mockResolvedValue({
        id: "sub_stripe_123",
        status: "active",
        customerId: "cus_123",
        priceId: "price_unknown",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        trialStart: null,
        trialEnd: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      });
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue(activeSubscription);

      await subscriptionService.handleCheckoutSessionCompleted(baseSession);

      expect(subscriptionRepository.updateByTenantId).toHaveBeenCalledWith(
        "tenant-1",
        "platform",
        expect.objectContaining({
          plan: "starter",
        })
      );
      consoleSpy.mockRestore();
    });

    it("should default to starter plan when priceId is null", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      vi.mocked(stripeService.getSubscription).mockResolvedValue({
        id: "sub_stripe_123",
        status: "active",
        customerId: "cus_123",
        priceId: null,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        trialStart: null,
        trialEnd: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      });
      vi.mocked(subscriptionRepository.getByTenantId).mockResolvedValue(activeSubscription);

      await subscriptionService.handleCheckoutSessionCompleted(baseSession);

      expect(subscriptionRepository.updateByTenantId).toHaveBeenCalledWith(
        "tenant-1",
        "platform",
        expect.objectContaining({
          plan: "starter",
        })
      );
      consoleSpy.mockRestore();
    });
  });

  describe("handleSubscriptionCreated", () => {
    const baseSubscription = {
      id: "sub_stripe_new",
      customer: "cus_123",
      status: "trialing",
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
      trial_start: Math.floor(Date.now() / 1000),
      trial_end: Math.floor(Date.now() / 1000) + 14 * 86400,
      cancel_at_period_end: false,
      canceled_at: null,
      items: {
        data: [{ price: { id: "price_starter_test" } }],
      },
      metadata: { tenantId: "tenant-1" },
    };

    it("should return early when tenantId missing", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await subscriptionService.handleSubscriptionCreated({
        ...baseSubscription,
        metadata: {},
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("without tenantId"),
        "sub_stripe_new"
      );
      expect(subscriptionRepository.create).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should return early when subscription already exists", async () => {
      vi.mocked(subscriptionRepository.getByStripeSubscriptionId).mockResolvedValue(
        activeSubscription
      );

      await subscriptionService.handleSubscriptionCreated(baseSubscription);

      expect(subscriptionRepository.create).not.toHaveBeenCalled();
    });

    it("should create subscription record with correct data", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      vi.mocked(subscriptionRepository.getByStripeSubscriptionId).mockResolvedValue(null);

      await subscriptionService.handleSubscriptionCreated(baseSubscription);

      expect(subscriptionRepository.create).toHaveBeenCalledWith(
        "tenant-1",
        "platform",
        expect.objectContaining({
          stripeCustomerId: "cus_123",
          stripeSubscriptionId: "sub_stripe_new",
          stripePriceId: "price_starter_test",
          plan: "starter",
          status: "trialing",
        })
      );
      consoleSpy.mockRestore();
    });

    it("should handle subscription with no price items", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      vi.mocked(subscriptionRepository.getByStripeSubscriptionId).mockResolvedValue(null);

      await subscriptionService.handleSubscriptionCreated({
        ...baseSubscription,
        items: { data: [] },
      });

      expect(subscriptionRepository.create).toHaveBeenCalledWith(
        "tenant-1",
        "platform",
        expect.objectContaining({
          plan: "starter", // defaults to starter
        })
      );
      consoleSpy.mockRestore();
    });

    it("should handle subscription without trial dates", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      vi.mocked(subscriptionRepository.getByStripeSubscriptionId).mockResolvedValue(null);

      await subscriptionService.handleSubscriptionCreated({
        ...baseSubscription,
        trial_start: null,
        trial_end: null,
      });

      expect(subscriptionRepository.create).toHaveBeenCalledWith(
        "tenant-1",
        "platform",
        expect.objectContaining({
          trialStart: undefined,
          trialEnd: undefined,
        })
      );
      consoleSpy.mockRestore();
    });
  });

  describe("handleSubscriptionUpdated", () => {
    const baseSubscription = {
      id: "sub_stripe_123",
      customer: "cus_123",
      status: "active",
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
      trial_start: null,
      trial_end: null,
      cancel_at_period_end: false,
      canceled_at: null,
      items: {
        data: [{ price: { id: "price_starter_test" } }],
      },
      metadata: { tenantId: "tenant-1" },
    };

    it("should update existing subscription", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      vi.mocked(subscriptionRepository.getByStripeSubscriptionId).mockResolvedValue(
        activeSubscription
      );

      await subscriptionService.handleSubscriptionUpdated(baseSubscription);

      expect(subscriptionRepository.update).toHaveBeenCalledWith(
        "sub-1",
        expect.objectContaining({
          status: "active",
          stripePriceId: "price_starter_test",
          cancelAtPeriodEnd: false,
          canceledAt: null,
          plan: "starter",
        })
      );
      consoleSpy.mockRestore();
    });

    it("should fallback to create when subscription not found but has tenantId", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.mocked(subscriptionRepository.getByStripeSubscriptionId)
        .mockResolvedValueOnce(null) // first call in handleSubscriptionUpdated
        .mockResolvedValueOnce(null); // second call in handleSubscriptionCreated

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await subscriptionService.handleSubscriptionUpdated(baseSubscription);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("not found for update"),
        "sub_stripe_123"
      );
      // Should have called handleSubscriptionCreated
      expect(subscriptionRepository.create).toHaveBeenCalled();
      consoleSpy.mockRestore();
      logSpy.mockRestore();
    });

    it("should not create when subscription not found and no tenantId", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.mocked(subscriptionRepository.getByStripeSubscriptionId).mockResolvedValue(null);

      await subscriptionService.handleSubscriptionUpdated({
        ...baseSubscription,
        metadata: {},
      });

      expect(subscriptionRepository.create).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should handle update with trial dates", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      vi.mocked(subscriptionRepository.getByStripeSubscriptionId).mockResolvedValue(
        activeSubscription
      );

      const trialStart = Math.floor(Date.now() / 1000);
      const trialEnd = trialStart + 14 * 86400;

      await subscriptionService.handleSubscriptionUpdated({
        ...baseSubscription,
        trial_start: trialStart,
        trial_end: trialEnd,
      });

      expect(subscriptionRepository.update).toHaveBeenCalledWith(
        "sub-1",
        expect.objectContaining({
          trialStart: new Date(trialStart * 1000),
          trialEnd: new Date(trialEnd * 1000),
        })
      );
      consoleSpy.mockRestore();
    });

    it("should handle update with canceled_at", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      vi.mocked(subscriptionRepository.getByStripeSubscriptionId).mockResolvedValue(
        activeSubscription
      );

      const canceledAt = Math.floor(Date.now() / 1000);

      await subscriptionService.handleSubscriptionUpdated({
        ...baseSubscription,
        cancel_at_period_end: true,
        canceled_at: canceledAt,
      });

      expect(subscriptionRepository.update).toHaveBeenCalledWith(
        "sub-1",
        expect.objectContaining({
          cancelAtPeriodEnd: true,
          canceledAt: new Date(canceledAt * 1000),
        })
      );
      consoleSpy.mockRestore();
    });

    it("should detect plan from priceId and update plan code", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      vi.mocked(subscriptionRepository.getByStripeSubscriptionId).mockResolvedValue(
        activeSubscription
      );

      await subscriptionService.handleSubscriptionUpdated({
        ...baseSubscription,
        items: { data: [{ price: { id: "price_pro_test" } }] },
      });

      expect(subscriptionRepository.update).toHaveBeenCalledWith(
        "sub-1",
        expect.objectContaining({
          plan: "pro",
        })
      );
      consoleSpy.mockRestore();
    });

    it("should not set plan when priceId is not recognized", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      vi.mocked(subscriptionRepository.getByStripeSubscriptionId).mockResolvedValue(
        activeSubscription
      );

      await subscriptionService.handleSubscriptionUpdated({
        ...baseSubscription,
        items: { data: [{ price: { id: "price_unknown" } }] },
      });

      // updateData.plan should not be set (unrecognized priceId doesn't set plan in updateData)
      const updateCall = vi.mocked(subscriptionRepository.update).mock.calls[0];
      expect(updateCall[1]).not.toHaveProperty("plan");
      consoleSpy.mockRestore();
    });

    it("should not set plan when no price items", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      vi.mocked(subscriptionRepository.getByStripeSubscriptionId).mockResolvedValue(
        activeSubscription
      );

      await subscriptionService.handleSubscriptionUpdated({
        ...baseSubscription,
        items: { data: [] },
      });

      // No plan should be set in updateData when there are no price items
      const updateCall = vi.mocked(subscriptionRepository.update).mock.calls[0];
      expect(updateCall[1]).not.toHaveProperty("plan");
      consoleSpy.mockRestore();
    });
  });

  describe("handleSubscriptionDeleted", () => {
    const baseSubscription = {
      id: "sub_stripe_123",
      customer: "cus_123",
      status: "canceled",
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
      trial_start: null,
      trial_end: null,
      cancel_at_period_end: false,
      canceled_at: Math.floor(Date.now() / 1000),
      items: { data: [{ price: { id: "price_starter_test" } }] },
      metadata: { tenantId: "tenant-1" },
    };

    it("should mark subscription as canceled", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      vi.mocked(subscriptionRepository.getByStripeSubscriptionId).mockResolvedValue(
        activeSubscription
      );

      await subscriptionService.handleSubscriptionDeleted(baseSubscription);

      expect(subscriptionRepository.update).toHaveBeenCalledWith("sub-1", {
        status: "canceled",
        canceledAt: expect.any(Date),
      });
      consoleSpy.mockRestore();
    });

    it("should return early when subscription not found", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.mocked(subscriptionRepository.getByStripeSubscriptionId).mockResolvedValue(null);

      await subscriptionService.handleSubscriptionDeleted(baseSubscription);

      expect(subscriptionRepository.update).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("not found for deletion"),
        "sub_stripe_123"
      );
      consoleSpy.mockRestore();
    });
  });

  describe("handleInvoicePaymentSucceeded", () => {
    const baseInvoice = {
      id: "inv_123",
      customer: "cus_123",
      subscription: "sub_stripe_123",
      status: "paid",
      amount_paid: 4900,
      amount_due: 4900,
      currency: "usd",
    };

    it("should clear grace period and set status to active", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      vi.mocked(subscriptionRepository.getByStripeSubscriptionId).mockResolvedValue(
        activeSubscription
      );

      await subscriptionService.handleInvoicePaymentSucceeded(baseInvoice);

      expect(subscriptionRepository.update).toHaveBeenCalledWith("sub-1", {
        status: "active",
        gracePeriodEnd: null,
      });
      consoleSpy.mockRestore();
    });

    it("should return early when invoice has no subscription", async () => {
      await subscriptionService.handleInvoicePaymentSucceeded({
        ...baseInvoice,
        subscription: null,
      });

      expect(subscriptionRepository.getByStripeSubscriptionId).not.toHaveBeenCalled();
    });

    it("should warn when subscription not found", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.mocked(subscriptionRepository.getByStripeSubscriptionId).mockResolvedValue(null);

      await subscriptionService.handleInvoicePaymentSucceeded(baseInvoice);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("not found for invoice"),
        "sub_stripe_123"
      );
      expect(subscriptionRepository.update).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("handleInvoicePaymentFailed", () => {
    const baseInvoice = {
      id: "inv_456",
      customer: "cus_123",
      subscription: "sub_stripe_123",
      status: "open",
      amount_paid: 0,
      amount_due: 4900,
      currency: "usd",
    };

    it("should set grace period and mark as past_due", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      vi.mocked(subscriptionRepository.getByStripeSubscriptionId).mockResolvedValue(
        activeSubscription
      );

      await subscriptionService.handleInvoicePaymentFailed(baseInvoice);

      expect(subscriptionRepository.update).toHaveBeenCalledWith("sub-1", {
        status: "past_due",
        gracePeriodEnd: expect.any(Date),
      });

      // Verify grace period is approximately 7 days from now
      const call = vi.mocked(subscriptionRepository.update).mock.calls[0];
      const gracePeriodEnd = (call[1] as { gracePeriodEnd: Date }).gracePeriodEnd;
      const diffDays = (gracePeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(6);
      expect(diffDays).toBeLessThan(8);

      consoleSpy.mockRestore();
    });

    it("should return early when invoice has no subscription", async () => {
      await subscriptionService.handleInvoicePaymentFailed({
        ...baseInvoice,
        subscription: null,
      });

      expect(subscriptionRepository.getByStripeSubscriptionId).not.toHaveBeenCalled();
    });

    it("should warn when subscription not found", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.mocked(subscriptionRepository.getByStripeSubscriptionId).mockResolvedValue(null);

      await subscriptionService.handleInvoicePaymentFailed(baseInvoice);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("not found for failed invoice"),
        "sub_stripe_123"
      );
      expect(subscriptionRepository.update).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
