import { describe, it, expect, vi, beforeEach } from "vitest";
import { SubscriptionRepository } from "../subscription.repository";

vi.mock("@/lib/db", () => ({
  default: {
    subscription: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    tenant: {
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/id", () => ({
  generateEntityId: vi.fn(() => "sub-id-123"),
}));

import prisma from "@/lib/db";

describe("SubscriptionRepository", () => {
  let repo: SubscriptionRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new SubscriptionRepository();
  });

  describe("getByTenantId", () => {
    it("should find subscription by tenantId", async () => {
      const mockSub = { id: "sub-1", tenantId: "t1", status: "active" };
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(mockSub as never);

      const result = await repo.getByTenantId("t1");

      expect(prisma.subscription.findFirst).toHaveBeenCalledWith({
        where: { tenantId: "t1", deleted: false },
      });
      expect(result).toEqual(mockSub);
    });
  });

  describe("getByStripeCustomerId", () => {
    it("should find subscription by Stripe customer ID", async () => {
      const mockSub = { id: "sub-1", stripeCustomerId: "cus_123" };
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(mockSub as never);

      const result = await repo.getByStripeCustomerId("cus_123");

      expect(prisma.subscription.findFirst).toHaveBeenCalledWith({
        where: { stripeCustomerId: "cus_123", deleted: false },
      });
      expect(result).toEqual(mockSub);
    });
  });

  describe("getByStripeSubscriptionId", () => {
    it("should find subscription by Stripe subscription ID", async () => {
      const mockSub = { id: "sub-1", stripeSubscriptionId: "sub_stripe_123" };
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(mockSub as never);

      const result = await repo.getByStripeSubscriptionId("sub_stripe_123");

      expect(prisma.subscription.findFirst).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: "sub_stripe_123", deleted: false },
      });
      expect(result).toEqual(mockSub);
    });
  });

  describe("getWithTenant", () => {
    it("should find subscription with tenant details", async () => {
      const mockSub = {
        id: "sub-1",
        tenantId: "t1",
        tenant: { id: "t1", name: "Test", subscriptionPlan: "starter", subscriptionStatus: "active" },
      };
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(mockSub as never);

      const result = await repo.getWithTenant("t1");

      expect(prisma.subscription.findFirst).toHaveBeenCalledWith({
        where: { tenantId: "t1", deleted: false },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              subscriptionPlan: true,
              subscriptionStatus: true,
            },
          },
        },
      });
      expect(result).toEqual(mockSub);
    });
  });

  describe("create", () => {
    it("should create a subscription with defaults", async () => {
      const mockCreated = { id: "sub-id-123", tenantId: "t1", status: "incomplete" };
      vi.mocked(prisma.subscription.create).mockResolvedValue(mockCreated as never);

      const result = await repo.create("t1", {
        stripeCustomerId: "cus_123",
      });

      expect(prisma.subscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: "sub-id-123",
          tenantId: "t1",
          stripeCustomerId: "cus_123",
          status: "incomplete",
          plan: "starter",
        }),
      });
      expect(result).toEqual(mockCreated);
    });

    it("should create a subscription with all fields", async () => {
      const now = new Date();
      vi.mocked(prisma.subscription.create).mockResolvedValue({} as never);

      await repo.create("t1", {
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        stripePriceId: "price_123",
        status: "active",
        plan: "pro",
        currentPeriodStart: now,
        currentPeriodEnd: now,
        trialStart: now,
        trialEnd: now,
      });

      expect(prisma.subscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: "active",
          plan: "pro",
          stripeSubscriptionId: "sub_123",
          stripePriceId: "price_123",
        }),
      });
    });
  });

  describe("update", () => {
    it("should update subscription by ID", async () => {
      vi.mocked(prisma.subscription.update).mockResolvedValue({} as never);

      await repo.update("sub-1", { status: "canceled" });

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: "sub-1" },
        data: { status: "canceled" },
      });
    });
  });

  describe("updateByTenantId", () => {
    it("should update subscription by tenant ID", async () => {
      vi.mocked(prisma.subscription.update).mockResolvedValue({} as never);

      await repo.updateByTenantId("t1", { status: "active" });

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { tenantId: "t1" },
        data: { status: "active" },
      });
    });
  });

  describe("updateByStripeSubscriptionId", () => {
    it("should update subscription by Stripe subscription ID", async () => {
      vi.mocked(prisma.subscription.update).mockResolvedValue({} as never);

      await repo.updateByStripeSubscriptionId("sub_stripe_123", { status: "past_due" });

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: "sub_stripe_123" },
        data: { status: "past_due" },
      });
    });
  });

  describe("updateByStripeCustomerId", () => {
    it("should update subscription by Stripe customer ID", async () => {
      vi.mocked(prisma.subscription.update).mockResolvedValue({} as never);

      await repo.updateByStripeCustomerId("cus_123", { cancelAtPeriodEnd: true });

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { stripeCustomerId: "cus_123" },
        data: { cancelAtPeriodEnd: true },
      });
    });
  });

  describe("delete", () => {
    it("should soft delete by ID", async () => {
      vi.mocked(prisma.subscription.update).mockResolvedValue({} as never);

      await repo.delete("sub-1");

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: "sub-1" },
        data: { deleted: true, updatedAt: expect.any(Date) },
      });
    });
  });

  describe("deleteByTenantId", () => {
    it("should soft delete by tenant ID", async () => {
      vi.mocked(prisma.subscription.update).mockResolvedValue({} as never);

      await repo.deleteByTenantId("t1");

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { tenantId: "t1" },
        data: { deleted: true, updatedAt: expect.any(Date) },
      });
    });
  });

  describe("updateTenantSubscriptionStatus", () => {
    it("should update tenant denormalized fields", async () => {
      vi.mocked(prisma.tenant.update).mockResolvedValue({} as never);

      await repo.updateTenantSubscriptionStatus("t1", "pro", "active");

      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: "t1" },
        data: { subscriptionPlan: "pro", subscriptionStatus: "active" },
      });
    });
  });

  describe("exists", () => {
    it("should return true when subscription exists", async () => {
      vi.mocked(prisma.subscription.count).mockResolvedValue(1);

      const result = await repo.exists("t1");

      expect(result).toBe(true);
      expect(prisma.subscription.count).toHaveBeenCalledWith({
        where: { tenantId: "t1", deleted: false },
      });
    });

    it("should return false when no subscription exists", async () => {
      vi.mocked(prisma.subscription.count).mockResolvedValue(0);

      const result = await repo.exists("t1");

      expect(result).toBe(false);
    });
  });
});
