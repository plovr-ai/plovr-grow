import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCodes } from "@/lib/errors/error-codes";

// Mock dependencies before importing the service
vi.mock("@/services/stripe", () => ({
  stripeService: {
    generateConnectOAuthUrl: vi.fn(),
    handleConnectOAuthCallback: vi.fn(),
    getConnectAccountStatus: vi.fn(),
    disconnectConnectAccount: vi.fn(),
  },
}));

vi.mock("@/repositories/stripe-connect-account.repository", () => ({
  stripeConnectAccountRepository: {
    create: vi.fn(),
    getByTenantId: vi.fn(),
    getByStripeAccountId: vi.fn(),
    updateAccountStatus: vi.fn(),
    softDelete: vi.fn(),
  },
}));

vi.mock("@/repositories/tenant.repository", () => ({
  tenantRepository: {
    update: vi.fn(),
  },
}));

// Import mocked modules
import { stripeService } from "@/services/stripe";
import { stripeConnectAccountRepository } from "@/repositories/stripe-connect-account.repository";
import { tenantRepository } from "@/repositories/tenant.repository";

const mockStripeService = vi.mocked(stripeService);
const mockRepo = vi.mocked(stripeConnectAccountRepository);
const mockTenantRepoUpdate = vi.mocked(tenantRepository).update;

const TENANT_ID = "tenant-123";
const STRIPE_ACCOUNT_ID = "acct_test_123";
const REDIRECT_URI = "https://example.com/callback";

describe("StripeConnectService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Set STRIPE_CLIENT_ID by default
    process.env.STRIPE_CLIENT_ID = "ca_test_client_id";
  });

  describe("generateOAuthUrl", () => {
    it("should generate OAuth URL with base64url-encoded state", async () => {
      mockStripeService.generateConnectOAuthUrl.mockReturnValue(
        "https://connect.stripe.com/oauth/authorize?..."
      );

      const { stripeConnectService: service } = await import("../stripe-connect.service");

      const url = service.generateOAuthUrl(TENANT_ID, REDIRECT_URI);

      expect(mockStripeService.generateConnectOAuthUrl).toHaveBeenCalledWith(
        "ca_test_client_id",
        REDIRECT_URI,
        expect.any(String)
      );
      expect(url).toBe("https://connect.stripe.com/oauth/authorize?...");

      // Verify state is base64url-encoded with tenantId
      const stateArg = mockStripeService.generateConnectOAuthUrl.mock.calls[0][2];
      const decoded = JSON.parse(Buffer.from(stateArg, "base64url").toString("utf-8"));
      expect(decoded).toEqual({ tenantId: TENANT_ID });
    });

    it("should throw STRIPE_CONNECT_NOT_CONFIGURED when STRIPE_CLIENT_ID is missing", async () => {
      delete process.env.STRIPE_CLIENT_ID;

      const { stripeConnectService: service } = await import("../stripe-connect.service");

      expect(() => service.generateOAuthUrl(TENANT_ID, REDIRECT_URI)).toThrow(AppError);
      expect(() => service.generateOAuthUrl(TENANT_ID, REDIRECT_URI)).toThrow(
        expect.objectContaining({ code: ErrorCodes.STRIPE_CONNECT_NOT_CONFIGURED })
      );
    });
  });

  describe("parseOAuthState", () => {
    it("should parse base64url-encoded state back to tenantId", async () => {
      const { stripeConnectService: service } = await import("../stripe-connect.service");

      const state = Buffer.from(JSON.stringify({ tenantId: TENANT_ID })).toString("base64url");
      const result = service.parseOAuthState(state);

      expect(result).toEqual({ tenantId: TENANT_ID });
    });
  });

  describe("handleOAuthCallback", () => {
    it("should create account and update tenant on successful OAuth", async () => {
      mockRepo.getByTenantId.mockResolvedValue(null);
      mockStripeService.handleConnectOAuthCallback.mockResolvedValue({
        access_token: "tok_access",
        refresh_token: "tok_refresh",
        stripe_user_id: STRIPE_ACCOUNT_ID,
        scope: "read_write",
      });
      mockStripeService.getConnectAccountStatus.mockResolvedValue({
        id: STRIPE_ACCOUNT_ID,
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
      });
      mockRepo.create.mockResolvedValue({
        id: "ca-record-1",
        tenantId: TENANT_ID,
        stripeAccountId: STRIPE_ACCOUNT_ID,
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        accessToken: "tok_access",
        refreshToken: "tok_refresh",
        scope: "read_write",
        connectedAt: new Date(),
        disconnectedAt: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockTenantRepoUpdate.mockResolvedValue({} as never);

      const { stripeConnectService: service } = await import("../stripe-connect.service");

      const result = await service.handleOAuthCallback("auth_code_123", TENANT_ID);

      expect(result).toEqual({
        stripeAccountId: STRIPE_ACCOUNT_ID,
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
      });

      expect(mockRepo.getByTenantId).toHaveBeenCalledWith(TENANT_ID);
      expect(mockStripeService.handleConnectOAuthCallback).toHaveBeenCalledWith("auth_code_123");
      expect(mockStripeService.getConnectAccountStatus).toHaveBeenCalledWith(STRIPE_ACCOUNT_ID);
      expect(mockRepo.create).toHaveBeenCalledWith(
        TENANT_ID,
        {
          stripeAccountId: STRIPE_ACCOUNT_ID,
          accessToken: "tok_access",
          refreshToken: "tok_refresh",
          scope: "read_write",
        }
      );
      expect(mockTenantRepoUpdate).toHaveBeenCalledWith(TENANT_ID, {
        stripeConnectStatus: "connected",
      });
    });

    it("should throw STRIPE_CONNECT_ALREADY_CONNECTED if tenant already has account", async () => {
      mockRepo.getByTenantId.mockResolvedValue({
        id: "existing-record",
        tenantId: TENANT_ID,
        stripeAccountId: STRIPE_ACCOUNT_ID,
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        accessToken: null,
        refreshToken: null,
        scope: null,
        connectedAt: new Date(),
        disconnectedAt: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { stripeConnectService: service } = await import("../stripe-connect.service");

      await expect(service.handleOAuthCallback("auth_code_123", TENANT_ID)).rejects.toThrow(
        expect.objectContaining({ code: ErrorCodes.STRIPE_CONNECT_ALREADY_CONNECTED })
      );
    });

    it("should throw STRIPE_CONNECT_OAUTH_FAILED if Stripe OAuth fails", async () => {
      mockRepo.getByTenantId.mockResolvedValue(null);
      mockStripeService.handleConnectOAuthCallback.mockRejectedValue(new Error("Stripe error"));

      const { stripeConnectService: service } = await import("../stripe-connect.service");

      await expect(service.handleOAuthCallback("bad_code", TENANT_ID)).rejects.toThrow(
        expect.objectContaining({ code: ErrorCodes.STRIPE_CONNECT_OAUTH_FAILED })
      );
    });
  });

  describe("getConnectAccount", () => {
    it("should return account when found", async () => {
      const account = {
        id: "ca-1",
        tenantId: TENANT_ID,
        stripeAccountId: STRIPE_ACCOUNT_ID,
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        accessToken: null,
        refreshToken: null,
        scope: null,
        connectedAt: new Date(),
        disconnectedAt: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRepo.getByTenantId.mockResolvedValue(account);

      const { stripeConnectService: service } = await import("../stripe-connect.service");

      const result = await service.getConnectAccount(TENANT_ID);

      expect(result).toEqual(account);
      expect(mockRepo.getByTenantId).toHaveBeenCalledWith(TENANT_ID);
    });

    it("should return null when not found", async () => {
      mockRepo.getByTenantId.mockResolvedValue(null);

      const { stripeConnectService: service } = await import("../stripe-connect.service");

      const result = await service.getConnectAccount(TENANT_ID);

      expect(result).toBeNull();
    });
  });

  describe("isAccountReady", () => {
    it("should return true when chargesEnabled is true", async () => {
      mockRepo.getByTenantId.mockResolvedValue({
        id: "ca-1",
        tenantId: TENANT_ID,
        stripeAccountId: STRIPE_ACCOUNT_ID,
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        accessToken: null,
        refreshToken: null,
        scope: null,
        connectedAt: new Date(),
        disconnectedAt: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { stripeConnectService: service } = await import("../stripe-connect.service");

      const result = await service.isAccountReady(TENANT_ID);

      expect(result).toBe(true);
    });

    it("should return false when chargesEnabled is false", async () => {
      mockRepo.getByTenantId.mockResolvedValue({
        id: "ca-1",
        tenantId: TENANT_ID,
        stripeAccountId: STRIPE_ACCOUNT_ID,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        accessToken: null,
        refreshToken: null,
        scope: null,
        connectedAt: new Date(),
        disconnectedAt: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { stripeConnectService: service } = await import("../stripe-connect.service");

      const result = await service.isAccountReady(TENANT_ID);

      expect(result).toBe(false);
    });

    it("should return false when no account found", async () => {
      mockRepo.getByTenantId.mockResolvedValue(null);

      const { stripeConnectService: service } = await import("../stripe-connect.service");

      const result = await service.isAccountReady(TENANT_ID);

      expect(result).toBe(false);
    });
  });

  describe("disconnectAccount", () => {
    it("should disconnect and soft delete account", async () => {
      const account = {
        id: "ca-1",
        tenantId: TENANT_ID,
        stripeAccountId: STRIPE_ACCOUNT_ID,
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        accessToken: null,
        refreshToken: null,
        scope: null,
        connectedAt: new Date(),
        disconnectedAt: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRepo.getByTenantId.mockResolvedValue(account);
      mockStripeService.disconnectConnectAccount.mockResolvedValue(undefined);
      mockRepo.softDelete.mockResolvedValue({ ...account, deleted: true });
      mockTenantRepoUpdate.mockResolvedValue({} as never);

      const { stripeConnectService: service } = await import("../stripe-connect.service");

      await service.disconnectAccount(TENANT_ID);

      expect(mockStripeService.disconnectConnectAccount).toHaveBeenCalledWith(STRIPE_ACCOUNT_ID);
      expect(mockRepo.softDelete).toHaveBeenCalledWith("ca-1");
      expect(mockTenantRepoUpdate).toHaveBeenCalledWith(TENANT_ID, {
        stripeConnectStatus: "disconnected",
      });
    });

    it("should throw STRIPE_CONNECT_ACCOUNT_NOT_FOUND when no account exists", async () => {
      mockRepo.getByTenantId.mockResolvedValue(null);

      const { stripeConnectService: service } = await import("../stripe-connect.service");

      await expect(service.disconnectAccount(TENANT_ID)).rejects.toThrow(
        expect.objectContaining({ code: ErrorCodes.STRIPE_CONNECT_ACCOUNT_NOT_FOUND })
      );
    });

    it("should throw STRIPE_CONNECT_DISCONNECT_FAILED when Stripe call fails", async () => {
      mockRepo.getByTenantId.mockResolvedValue({
        id: "ca-1",
        tenantId: TENANT_ID,
        stripeAccountId: STRIPE_ACCOUNT_ID,
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        accessToken: null,
        refreshToken: null,
        scope: null,
        connectedAt: new Date(),
        disconnectedAt: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockStripeService.disconnectConnectAccount.mockRejectedValue(new Error("Stripe error"));

      const { stripeConnectService: service } = await import("../stripe-connect.service");

      await expect(service.disconnectAccount(TENANT_ID)).rejects.toThrow(
        expect.objectContaining({ code: ErrorCodes.STRIPE_CONNECT_DISCONNECT_FAILED })
      );
    });
  });

  describe("handleAccountUpdated", () => {
    it("should update account status when account found", async () => {
      const account = {
        id: "ca-1",
        tenantId: TENANT_ID,
        stripeAccountId: STRIPE_ACCOUNT_ID,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        accessToken: null,
        refreshToken: null,
        scope: null,
        connectedAt: new Date(),
        disconnectedAt: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRepo.getByStripeAccountId.mockResolvedValue(account);
      mockRepo.updateAccountStatus.mockResolvedValue({ ...account, chargesEnabled: true });

      const { stripeConnectService: service } = await import("../stripe-connect.service");

      const status = {
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
      };

      await service.handleAccountUpdated(STRIPE_ACCOUNT_ID, status);

      expect(mockRepo.getByStripeAccountId).toHaveBeenCalledWith(STRIPE_ACCOUNT_ID);
      expect(mockRepo.updateAccountStatus).toHaveBeenCalledWith("ca-1", status);
    });

    it("should silently ignore unknown accounts", async () => {
      mockRepo.getByStripeAccountId.mockResolvedValue(null);

      const { stripeConnectService: service } = await import("../stripe-connect.service");

      // Should not throw
      await expect(
        service.handleAccountUpdated("acct_unknown", {
          chargesEnabled: true,
          payoutsEnabled: true,
          detailsSubmitted: true,
        })
      ).resolves.toBeUndefined();

      expect(mockRepo.updateAccountStatus).not.toHaveBeenCalled();
    });
  });
});
