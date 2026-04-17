import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/repositories/user.repository", () => ({
  userRepository: {
    findByStytchUserId: vi.fn(),
    findByEmailGlobal: vi.fn(),
    findByTenantAndEmail: vi.fn(),
    updateLastLogin: vi.fn(),
    linkStytch: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/repositories/tenant.repository", () => ({
  tenantRepository: {
    getById: vi.fn(),
  },
}));

vi.mock("@/services/tenant/tenant.service", () => ({
  tenantService: {
    createTenantWithMerchant: vi.fn(),
  },
}));

vi.mock("@/lib/transaction", () => ({
  runInTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({})
  ),
}));

import { authService } from "../auth.service";
import { userRepository } from "@/repositories/user.repository";
import { tenantRepository } from "@/repositories/tenant.repository";
import { tenantService } from "@/services/tenant/tenant.service";

describe("AuthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findOrCreateStytchUser", () => {
    const existingUser = {
      id: "user-1",
      tenantId: "tenant-1",
      email: "existing@test.com",
      stytchUserId: "stytch-1",
      name: "Existing",
      role: "owner",
      status: "active",
      lastLoginAt: new Date(),
      passwordHash: null,
      deleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("returns existing user when Stytch ID already linked", async () => {
      vi.mocked(userRepository.findByStytchUserId).mockResolvedValue(existingUser);
      vi.mocked(userRepository.updateLastLogin).mockResolvedValue(existingUser);

      const result = await authService.findOrCreateStytchUser(
        "existing@test.com",
        "stytch-1"
      );

      expect(result.isNewUser).toBe(false);
      expect(result.user).toEqual(existingUser);
      expect(userRepository.updateLastLogin).toHaveBeenCalledWith("user-1");
      expect(userRepository.findByEmailGlobal).not.toHaveBeenCalled();
    });

    it("links Stytch ID to existing user when email already exists", async () => {
      const linked = { ...existingUser, stytchUserId: "stytch-new" };
      vi.mocked(userRepository.findByStytchUserId).mockResolvedValue(null);
      vi.mocked(userRepository.findByEmailGlobal).mockResolvedValue(existingUser);
      vi.mocked(userRepository.linkStytch).mockResolvedValue(linked);

      const result = await authService.findOrCreateStytchUser(
        "existing@test.com",
        "stytch-new"
      );

      expect(result.isNewUser).toBe(false);
      expect(result.user).toEqual(linked);
      expect(userRepository.linkStytch).toHaveBeenCalledWith("user-1", "stytch-new");
    });

    it("creates tenant+merchant+user when the email is new", async () => {
      vi.mocked(userRepository.findByStytchUserId).mockResolvedValue(null);
      vi.mocked(userRepository.findByEmailGlobal).mockResolvedValue(null);
      vi.mocked(tenantService.createTenantWithMerchant).mockResolvedValue({
        tenant: { id: "tenant-new", slug: "newbiz" },
        merchant: { id: "merchant-new" },
      } as never);
      const createdUser = { ...existingUser, id: "user-new", tenantId: "tenant-new" };
      vi.mocked(userRepository.create).mockResolvedValue(createdUser);

      const result = await authService.findOrCreateStytchUser(
        "newbiz@test.com",
        "stytch-newbie"
      );

      expect(result.isNewUser).toBe(true);
      expect(result.user).toEqual(createdUser);
      expect(tenantService.createTenantWithMerchant).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "newbiz's Company",
          source: "signup",
        })
      );
      expect(userRepository.create).toHaveBeenCalledWith(
        "tenant-new",
        expect.objectContaining({
          email: "newbiz@test.com",
          stytchUserId: "stytch-newbie",
          name: "newbiz",
          role: "owner",
          status: "active",
        }),
        expect.anything()
      );
    });
  });

  describe("claimTenant", () => {
    it("returns companySlug after creating the owner user", async () => {
      vi.mocked(tenantRepository.getById).mockResolvedValue({
        id: "tenant-1",
        slug: "company-slug",
      } as never);
      vi.mocked(userRepository.findByTenantAndEmail).mockResolvedValue(null);
      vi.mocked(userRepository.create).mockResolvedValue({ id: "user-new" } as never);

      const result = await authService.claimTenant({
        tenantId: "tenant-1",
        email: "owner@test.com",
        name: "Owner",
      });

      expect(result.companySlug).toBe("company-slug");
      expect(userRepository.create).toHaveBeenCalledWith(
        "tenant-1",
        expect.objectContaining({
          email: "owner@test.com",
          name: "Owner",
          role: "owner",
          status: "active",
          passwordHash: null,
        })
      );
    });

    it("throws CLAIM_TENANT_NOT_FOUND when tenant does not exist", async () => {
      vi.mocked(tenantRepository.getById).mockResolvedValue(null);

      await expect(
        authService.claimTenant({
          tenantId: "missing",
          email: "x@y.com",
          name: "X",
        })
      ).rejects.toThrow("CLAIM_TENANT_NOT_FOUND");
    });

    it("throws AUTH_EMAIL_EXISTS when user already exists for this tenant", async () => {
      vi.mocked(tenantRepository.getById).mockResolvedValue({
        id: "tenant-1",
        slug: "company-slug",
      } as never);
      vi.mocked(userRepository.findByTenantAndEmail).mockResolvedValue({
        id: "user-exists",
      } as never);

      await expect(
        authService.claimTenant({
          tenantId: "tenant-1",
          email: "dup@test.com",
          name: "Dup",
        })
      ).rejects.toThrow("AUTH_EMAIL_EXISTS");
    });
  });
});
