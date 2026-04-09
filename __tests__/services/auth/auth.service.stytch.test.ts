import { describe, it, expect, beforeEach } from "vitest";
import { authService } from "@/services/auth";
import { mockUserStore, mockTenantStore, mockCompanyStore } from "@/services/auth";
import { clearAllStores } from "@/services/auth/mock-store";

describe("AuthService.findOrCreateStytchUser", () => {
  beforeEach(() => {
    clearAllStores();
  });

  it("returns existing user when email matches and links stytchUserId", async () => {
    const tenant = mockTenantStore.create("Test Co");
    const company = mockCompanyStore.create(tenant.id, "Test Co");
    mockUserStore.create({
      tenantId: tenant.id,
      companyId: company.id,
      email: "existing@test.com",
      passwordHash: "hashed_pw",
      stytchUserId: null,
      name: "Existing User",
      role: "owner",
      status: "active",
      lastLoginAt: null,
    });

    const result = await authService.findOrCreateStytchUser(
      "existing@test.com",
      "stytch-user-123"
    );

    expect(result.user.email).toBe("existing@test.com");
    expect(result.user.stytchUserId).toBe("stytch-user-123");
    expect(result.user.name).toBe("Existing User");
    expect(result.isNewUser).toBe(false);
  });

  it("creates new user when email not found", async () => {
    const result = await authService.findOrCreateStytchUser(
      "newuser@test.com",
      "stytch-user-456"
    );

    expect(result.user.email).toBe("newuser@test.com");
    expect(result.user.stytchUserId).toBe("stytch-user-456");
    expect(result.user.name).toBe("newuser");
    expect(result.user.passwordHash).toBeNull();
    expect(result.user.role).toBe("owner");
    expect(result.isNewUser).toBe(true);
  });

  it("returns existing user when stytchUserId already linked", async () => {
    await authService.findOrCreateStytchUser(
      "linked@test.com",
      "stytch-user-789"
    );

    const result = await authService.findOrCreateStytchUser(
      "linked@test.com",
      "stytch-user-789"
    );

    expect(result.user.email).toBe("linked@test.com");
    expect(result.isNewUser).toBe(false);
  });
});
