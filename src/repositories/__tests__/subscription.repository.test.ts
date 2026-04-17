import { describe, it, expect, vi, beforeEach } from "vitest";
import { SubscriptionRepository } from "../subscription.repository";

vi.mock("@/lib/db", () => ({
  default: {
    subscription: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
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
    it("should find subscription by tenantId and productLine", async () => {
      const mockSub = { id: "sub-1", tenantId: "t1", productLine: "platform", status: "active" };
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(mockSub as never);

      const result = await repo.getByTenantId("t1", "platform");

      expect(prisma.subscription.findFirst).toHaveBeenCalledWith({
        where: { tenantId: "t1", productLine: "platform", deleted: false },
      });
      expect(result).toEqual(mockSub);
    });
  });

  describe("getAllByTenantId", () => {
    it("should find all subscriptions by tenantId", async () => {
      const mockSubs = [
        { id: "sub-1", tenantId: "t1", productLine: "platform", status: "active" },
        { id: "sub-2", tenantId: "t1", productLine: "phone_ai", status: "trialing" },
      ];
      vi.mocked(prisma.subscription.findMany).mockResolvedValue(mockSubs as never);

      const result = await repo.getAllByTenantId("t1");

      expect(prisma.subscription.findMany).toHaveBeenCalledWith({
        where: { tenantId: "t1", deleted: false },
      });
      expect(result).toEqual(mockSubs);
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

  describe("create", () => {
    it("should create a subscription with defaults", async () => {
      const mockCreated = { id: "sub-id-123", tenantId: "t1", status: "incomplete" };
      vi.mocked(prisma.subscription.create).mockResolvedValue(mockCreated as never);

      const result = await repo.create("t1", "platform", {
        stripeCustomerId: "cus_123",
      });

      expect(prisma.subscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: "sub-id-123",
          tenantId: "t1",
          productLine: "platform",
          stripeCustomerId: "cus_123",
          status: "incomplete",
          plan: "free",
        }),
      });
      expect(result).toEqual(mockCreated);
    });

    it("should create a subscription with all fields", async () => {
      const now = new Date();
      vi.mocked(prisma.subscription.create).mockResolvedValue({} as never);

      await repo.create("t1", "platform", {
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
          productLine: "platform",
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
    it("should update subscription by tenant ID and productLine", async () => {
      vi.mocked(prisma.subscription.update).mockResolvedValue({} as never);

      await repo.updateByTenantId("t1", "platform", { status: "active" });

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { tenantId_productLine: { tenantId: "t1", productLine: "platform" } },
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
    it("should soft delete by tenant ID and productLine", async () => {
      vi.mocked(prisma.subscription.update).mockResolvedValue({} as never);

      await repo.deleteByTenantId("t1", "platform");

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { tenantId_productLine: { tenantId: "t1", productLine: "platform" } },
        data: { deleted: true, updatedAt: expect.any(Date) },
      });
    });
  });

  describe("exists", () => {
    it("should return true when subscription exists", async () => {
      vi.mocked(prisma.subscription.count).mockResolvedValue(1);

      const result = await repo.exists("t1", "platform");

      expect(result).toBe(true);
      expect(prisma.subscription.count).toHaveBeenCalledWith({
        where: { tenantId: "t1", productLine: "platform", deleted: false },
      });
    });

    it("should return false when no subscription exists", async () => {
      vi.mocked(prisma.subscription.count).mockResolvedValue(0);

      const result = await repo.exists("t1", "platform");

      expect(result).toBe(false);
    });
  });
});
