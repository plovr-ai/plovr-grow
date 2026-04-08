import { describe, it, expect, vi, beforeEach } from "vitest";
import { StripeConnectAccountRepository } from "../stripe-connect-account.repository";

// Mock Prisma client
vi.mock("@/lib/db", () => ({
  default: {
    stripeConnectAccount: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from "@/lib/db";

describe("StripeConnectAccountRepository", () => {
  let repository: StripeConnectAccountRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new StripeConnectAccountRepository();
  });

  describe("create", () => {
    it("should create a new Stripe Connect account with required fields", async () => {
      const mockAccount = {
        id: "account-1",
        tenantId: "tenant-1",
        stripeAccountId: "acct_123",
        accessToken: null,
        refreshToken: null,
        scope: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        connectedAt: new Date(),
        disconnectedAt: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.stripeConnectAccount.create).mockResolvedValue(
        mockAccount
      );

      const result = await repository.create("tenant-1", {
        stripeAccountId: "acct_123",
      });

      expect(prisma.stripeConnectAccount.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          tenantId: "tenant-1",
          stripeAccountId: "acct_123",
          accessToken: undefined,
          refreshToken: undefined,
          scope: undefined,
          connectedAt: expect.any(Date),
        },
      });
      expect(result.tenantId).toBe("tenant-1");
      expect(result.stripeAccountId).toBe("acct_123");
    });

    it("should create a Stripe Connect account with all optional fields", async () => {
      const mockAccount = {
        id: "account-1",
        tenantId: "tenant-1",
        stripeAccountId: "acct_123",
        accessToken: "access_token_value",
        refreshToken: "refresh_token_value",
        scope: "read_write",
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        connectedAt: new Date(),
        disconnectedAt: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.stripeConnectAccount.create).mockResolvedValue(
        mockAccount
      );

      const result = await repository.create("tenant-1", {
        stripeAccountId: "acct_123",
        accessToken: "access_token_value",
        refreshToken: "refresh_token_value",
        scope: "read_write",
      });

      expect(prisma.stripeConnectAccount.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          tenantId: "tenant-1",
          stripeAccountId: "acct_123",
          accessToken: "access_token_value",
          refreshToken: "refresh_token_value",
          scope: "read_write",
          connectedAt: expect.any(Date),
        },
      });
      expect(result.accessToken).toBe("access_token_value");
    });

    it("should use provided transaction client when tx is passed", async () => {
      const mockTx = {
        stripeConnectAccount: {
          create: vi.fn(),
        },
      };

      const mockAccount = {
        id: "account-1",
        tenantId: "tenant-1",
        stripeAccountId: "acct_123",
        accessToken: null,
        refreshToken: null,
        scope: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        connectedAt: new Date(),
        disconnectedAt: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockTx.stripeConnectAccount.create).mockResolvedValue(
        mockAccount
      );

      await repository.create(
        "tenant-1",
        { stripeAccountId: "acct_123" },
        mockTx as unknown as Parameters<typeof repository.create>[2]
      );

      expect(mockTx.stripeConnectAccount.create).toHaveBeenCalled();
      expect(prisma.stripeConnectAccount.create).not.toHaveBeenCalled();
    });
  });

  describe("getByTenantId", () => {
    it("should return the account for a given tenant", async () => {
      const mockAccount = {
        id: "account-1",
        tenantId: "tenant-1",
        stripeAccountId: "acct_123",
        accessToken: null,
        refreshToken: null,
        scope: null,
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        connectedAt: new Date(),
        disconnectedAt: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.stripeConnectAccount.findFirst).mockResolvedValue(
        mockAccount
      );

      const result = await repository.getByTenantId("tenant-1");

      expect(prisma.stripeConnectAccount.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-1",
          deleted: false,
        },
      });
      expect(result?.tenantId).toBe("tenant-1");
    });

    it("should return null when no account exists for the tenant", async () => {
      vi.mocked(prisma.stripeConnectAccount.findFirst).mockResolvedValue(null);

      const result = await repository.getByTenantId("tenant-nonexistent");

      expect(result).toBeNull();
    });

    it("should not return soft-deleted accounts", async () => {
      vi.mocked(prisma.stripeConnectAccount.findFirst).mockResolvedValue(null);

      await repository.getByTenantId("tenant-1");

      expect(prisma.stripeConnectAccount.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-1",
          deleted: false,
        },
      });
    });
  });

  describe("getByStripeAccountId", () => {
    it("should return the account for a given Stripe account ID", async () => {
      const mockAccount = {
        id: "account-1",
        tenantId: "tenant-1",
        stripeAccountId: "acct_123",
        accessToken: null,
        refreshToken: null,
        scope: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        connectedAt: new Date(),
        disconnectedAt: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.stripeConnectAccount.findFirst).mockResolvedValue(
        mockAccount
      );

      const result = await repository.getByStripeAccountId("acct_123");

      expect(prisma.stripeConnectAccount.findFirst).toHaveBeenCalledWith({
        where: {
          stripeAccountId: "acct_123",
          deleted: false,
        },
      });
      expect(result?.stripeAccountId).toBe("acct_123");
    });

    it("should return null when Stripe account ID is not found", async () => {
      vi.mocked(prisma.stripeConnectAccount.findFirst).mockResolvedValue(null);

      const result = await repository.getByStripeAccountId("acct_nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("updateAccountStatus", () => {
    it("should update chargesEnabled status", async () => {
      const mockAccount = {
        id: "account-1",
        tenantId: "tenant-1",
        stripeAccountId: "acct_123",
        accessToken: null,
        refreshToken: null,
        scope: null,
        chargesEnabled: true,
        payoutsEnabled: false,
        detailsSubmitted: false,
        connectedAt: new Date(),
        disconnectedAt: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.stripeConnectAccount.update).mockResolvedValue(
        mockAccount
      );

      const result = await repository.updateAccountStatus("account-1", {
        chargesEnabled: true,
      });

      expect(prisma.stripeConnectAccount.update).toHaveBeenCalledWith({
        where: { id: "account-1" },
        data: {
          chargesEnabled: true,
        },
      });
      expect(result.chargesEnabled).toBe(true);
    });

    it("should update multiple status fields at once", async () => {
      const mockAccount = {
        id: "account-1",
        tenantId: "tenant-1",
        stripeAccountId: "acct_123",
        accessToken: null,
        refreshToken: null,
        scope: null,
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        connectedAt: new Date(),
        disconnectedAt: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.stripeConnectAccount.update).mockResolvedValue(
        mockAccount
      );

      await repository.updateAccountStatus("account-1", {
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
      });

      expect(prisma.stripeConnectAccount.update).toHaveBeenCalledWith({
        where: { id: "account-1" },
        data: {
          chargesEnabled: true,
          payoutsEnabled: true,
          detailsSubmitted: true,
        },
      });
    });

    it("should not include undefined fields in update data", async () => {
      const mockAccount = {
        id: "account-1",
        tenantId: "tenant-1",
        stripeAccountId: "acct_123",
        accessToken: null,
        refreshToken: null,
        scope: null,
        chargesEnabled: false,
        payoutsEnabled: true,
        detailsSubmitted: false,
        connectedAt: new Date(),
        disconnectedAt: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.stripeConnectAccount.update).mockResolvedValue(
        mockAccount
      );

      await repository.updateAccountStatus("account-1", {
        payoutsEnabled: true,
      });

      expect(prisma.stripeConnectAccount.update).toHaveBeenCalledWith({
        where: { id: "account-1" },
        data: {
          payoutsEnabled: true,
        },
      });
    });

    it("should pass empty data object when no fields provided", async () => {
      const mockAccount = {
        id: "account-1",
        tenantId: "tenant-1",
        stripeAccountId: "acct_123",
        accessToken: null,
        refreshToken: null,
        scope: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        connectedAt: new Date(),
        disconnectedAt: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.stripeConnectAccount.update).mockResolvedValue(
        mockAccount
      );

      await repository.updateAccountStatus("account-1", {});

      expect(prisma.stripeConnectAccount.update).toHaveBeenCalledWith({
        where: { id: "account-1" },
        data: {},
      });
    });
  });

  describe("softDelete", () => {
    it("should soft delete an account by setting deleted to true and recording disconnectedAt", async () => {
      const mockAccount = {
        id: "account-1",
        tenantId: "tenant-1",
        stripeAccountId: "acct_123",
        accessToken: null,
        refreshToken: null,
        scope: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        connectedAt: new Date(),
        disconnectedAt: new Date(),
        deleted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.stripeConnectAccount.update).mockResolvedValue(
        mockAccount
      );

      const result = await repository.softDelete("account-1");

      expect(prisma.stripeConnectAccount.update).toHaveBeenCalledWith({
        where: { id: "account-1" },
        data: {
          deleted: true,
          disconnectedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });
      expect(result.deleted).toBe(true);
      expect(result.disconnectedAt).toBeInstanceOf(Date);
    });
  });
});
