import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserRepository } from "../user.repository";

vi.mock("@/lib/db", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/id", () => ({
  generateEntityId: vi.fn(() => "generated-id-123"),
}));

import prisma from "@/lib/db";

describe("UserRepository", () => {
  let repository: UserRepository;

  const mockUser = {
    id: "user-1",
    tenantId: "tenant-1",
    email: "user@test.com",
    stytchUserId: "stytch-1",
    name: "Test User",
    role: "owner",
    status: "active",
    passwordHash: null,
    lastLoginAt: null,
    deleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new UserRepository();
  });

  describe("findByStytchUserId", () => {
    it("looks up by Stytch user ID", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);
      const result = await repository.findByStytchUserId("stytch-1");
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { stytchUserId: "stytch-1" },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe("findByEmailGlobal", () => {
    it("filters out deleted users when searching globally by email", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as never);
      const result = await repository.findByEmailGlobal("user@test.com");
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: "user@test.com", deleted: false },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe("findByTenantAndEmail", () => {
    it("scopes by tenantId when looking up by email", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as never);
      const result = await repository.findByTenantAndEmail(
        "tenant-1",
        "user@test.com"
      );
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1", email: "user@test.com" },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe("create", () => {
    it("generates an id and applies defaults", async () => {
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser as never);

      await repository.create("tenant-1", {
        email: "new@test.com",
        name: "New",
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          id: "generated-id-123",
          tenantId: "tenant-1",
          email: "new@test.com",
          name: "New",
          role: "staff",
          status: "active",
          stytchUserId: null,
          passwordHash: null,
          lastLoginAt: null,
        },
      });
    });

    it("honors explicit role/status/stytch/password overrides", async () => {
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser as never);
      const lastLoginAt = new Date();

      await repository.create("tenant-1", {
        email: "owner@test.com",
        name: "Owner",
        role: "owner",
        status: "pending",
        stytchUserId: "stytch-x",
        passwordHash: "hash-x",
        lastLoginAt,
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          role: "owner",
          status: "pending",
          stytchUserId: "stytch-x",
          passwordHash: "hash-x",
          lastLoginAt,
        }),
      });
    });

    it("passes tx client through when supplied", async () => {
      const tx = { user: { create: vi.fn().mockResolvedValue(mockUser) } };
      await repository.create(
        "tenant-1",
        { email: "tx@test.com", name: "Tx" },
        tx as never
      );

      expect(tx.user.create).toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe("updateLastLogin", () => {
    it("updates lastLoginAt to the current time", async () => {
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as never);

      await repository.updateLastLogin("user-1");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { lastLoginAt: expect.any(Date) },
      });
    });

    it("honors tx client when passed", async () => {
      const tx = { user: { update: vi.fn().mockResolvedValue(mockUser) } };
      await repository.updateLastLogin("user-1", tx as never);

      expect(tx.user.update).toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe("linkStytch", () => {
    it("sets stytchUserId and refreshes lastLoginAt", async () => {
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as never);

      await repository.linkStytch("user-1", "stytch-new");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { stytchUserId: "stytch-new", lastLoginAt: expect.any(Date) },
      });
    });

    it("honors tx client when passed", async () => {
      const tx = { user: { update: vi.fn().mockResolvedValue(mockUser) } };
      await repository.linkStytch("user-1", "stytch-new", tx as never);

      expect(tx.user.update).toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
