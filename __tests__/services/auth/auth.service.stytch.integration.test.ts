import { describe, it, expect, beforeEach } from "vitest";
import { authService } from "@/services/auth";
import prisma from "@/lib/db";
import { generateEntityId } from "@/lib/id";

describe("AuthService.findOrCreateStytchUser", () => {
  beforeEach(async () => {
    // Clean up test data in reverse dependency order
    await prisma.user.deleteMany({
      where: { email: { in: ["existing@test.com", "newuser@test.com", "linked@test.com"] } },
    });
    await prisma.merchant.deleteMany({
      where: { tenant: { name: { in: ["Test Co", "newuser's Company", "linked's Company"] } } },
    });
    await prisma.tenant.deleteMany({
      where: { name: { in: ["Test Co", "newuser's Company", "linked's Company"] } },
    });
  });

  it("returns existing user when email matches and links stytchUserId", async () => {
    // Seed test data in real database
    const tenantId = generateEntityId();

    await prisma.tenant.create({
      data: { id: tenantId, name: "Test Co", slug: `test-co-${Date.now()}` },
    });
    await prisma.user.create({
      data: {
        id: generateEntityId(),
        tenantId,
        email: "existing@test.com",
        passwordHash: "hashed_pw",
        name: "Existing User",
        role: "owner",
        status: "active",
      },
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

    // Verify data was created in the real database
    const dbUser = await prisma.user.findUnique({
      where: { stytchUserId: "stytch-user-456" },
    });
    expect(dbUser).not.toBeNull();
    expect(dbUser!.tenantId).toBeTruthy();

    // Verify tenant exists
    const dbTenant = await prisma.tenant.findUnique({ where: { id: dbUser!.tenantId } });
    expect(dbTenant).not.toBeNull();
    expect(dbTenant!.slug).toBeTruthy();

    // Verify a default merchant was also created in the same tenant
    const dbMerchants = await prisma.merchant.findMany({
      where: { tenantId: dbUser!.tenantId, deleted: false },
    });
    expect(dbMerchants).toHaveLength(1);
    expect(dbMerchants[0].name).toBe("newuser's Company");
    expect(dbMerchants[0].status).toBe("active");
    expect(dbMerchants[0].slug).toBeTruthy();
  });

  it("does not create a duplicate merchant when an existing user logs in", async () => {
    const tenantId = generateEntityId();
    await prisma.tenant.create({
      data: { id: tenantId, name: "Test Co", slug: `test-co-dup-${Date.now()}` },
    });
    await prisma.merchant.create({
      data: {
        id: generateEntityId(),
        tenantId,
        slug: `test-co-merchant-${Date.now()}`,
        name: "Test Co",
        status: "pending",
      },
    });
    await prisma.user.create({
      data: {
        id: generateEntityId(),
        tenantId,
        email: "existing@test.com",
        passwordHash: "hashed_pw",
        name: "Existing User",
        role: "owner",
        status: "active",
      },
    });

    await authService.findOrCreateStytchUser("existing@test.com", "stytch-user-dup");

    const merchants = await prisma.merchant.findMany({
      where: { tenantId, deleted: false },
    });
    expect(merchants).toHaveLength(1);
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
