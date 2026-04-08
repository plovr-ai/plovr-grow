import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("@/lib/db", () => {
  const mockPrisma = {
    integrationConnection: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    externalIdMapping: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    integrationSyncRecord: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
  };
  return { default: mockPrisma };
});

vi.mock("@/lib/id", () => ({
  generateEntityId: vi.fn(() => "test-id-123"),
}));

import prisma from "@/lib/db";
import { IntegrationRepository } from "../integration.repository";

type MockedFn = ReturnType<typeof vi.fn>;
type MockedPrisma = {
  integrationConnection: { findUnique: MockedFn; findFirst: MockedFn; upsert: MockedFn; update: MockedFn };
  externalIdMapping: { upsert: MockedFn; findMany: MockedFn; findFirst: MockedFn };
  integrationSyncRecord: { create: MockedFn; update: MockedFn; findFirst: MockedFn };
};
const mockPrisma = prisma as unknown as MockedPrisma;

describe("IntegrationRepository", () => {
  let repo: IntegrationRepository;

  beforeEach(() => {
    repo = new IntegrationRepository();
    vi.clearAllMocks();
  });

  describe("getConnection", () => {
    it("should find connection by tenantId, merchantId, and type", async () => {
      const mockConnection = {
        id: "conn-1",
        tenantId: "t1",
        merchantId: "m1",
        type: "POS_SQUARE",
        status: "active",
      };
      mockPrisma.integrationConnection.findUnique.mockResolvedValue(
        mockConnection as never
      );

      const result = await repo.getConnection("t1", "m1", "POS_SQUARE");

      expect(mockPrisma.integrationConnection.findUnique).toHaveBeenCalledWith({
        where: {
          tenantId_merchantId_type: {
            tenantId: "t1",
            merchantId: "m1",
            type: "POS_SQUARE",
          },
          deleted: false,
        },
      });
      expect(result).toEqual(mockConnection);
    });
  });

  describe("upsertConnection", () => {
    it("should upsert a connection", async () => {
      const input = {
        type: "POS_SQUARE",
        category: "POS",
        externalAccountId: "sq-merchant-1",
        accessToken: "token-123",
        refreshToken: "refresh-456",
        tokenExpiresAt: new Date("2026-05-08"),
        scopes: "ITEMS_READ",
      };
      mockPrisma.integrationConnection.upsert.mockResolvedValue({
        id: "test-id-123",
        ...input,
      } as never);

      await repo.upsertConnection("t1", "m1", input);

      expect(mockPrisma.integrationConnection.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId_merchantId_type: {
              tenantId: "t1",
              merchantId: "m1",
              type: "POS_SQUARE",
            },
          },
        })
      );
    });
  });

  describe("createSyncRecord", () => {
    it("should create a sync record with running status", async () => {
      mockPrisma.integrationSyncRecord.create.mockResolvedValue({
        id: "test-id-123",
        status: "running",
      } as never);

      const result = await repo.createSyncRecord("t1", "conn-1", "CATALOG_FULL");

      expect(mockPrisma.integrationSyncRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: "test-id-123",
          tenantId: "t1",
          connectionId: "conn-1",
          syncType: "CATALOG_FULL",
          status: "running",
        }),
      });
      expect(result).toEqual(expect.objectContaining({ status: "running" }));
    });
  });

  describe("getRunningSync", () => {
    it("should find running sync record within stale threshold", async () => {
      mockPrisma.integrationSyncRecord.findFirst.mockResolvedValue({
        id: "sync-1",
        status: "running",
      } as never);

      const result = await repo.getRunningSync("conn-1");

      expect(mockPrisma.integrationSyncRecord.findFirst).toHaveBeenCalledWith({
        where: {
          connectionId: "conn-1",
          status: "running",
          startedAt: { gte: expect.any(Date) },
        },
      });
      expect(result).toBeTruthy();
    });
  });

  describe("upsertIdMapping", () => {
    it("should upsert an external ID mapping", async () => {
      const mapping = {
        internalType: "MenuItem",
        internalId: "item-1",
        externalSource: "SQUARE",
        externalType: "ITEM",
        externalId: "sq-item-1",
      };
      mockPrisma.externalIdMapping.upsert.mockResolvedValue({
        id: "test-id-123",
        ...mapping,
      } as never);

      await repo.upsertIdMapping("t1", mapping);

      expect(mockPrisma.externalIdMapping.upsert).toHaveBeenCalledWith({
        where: {
          tenantId_externalSource_externalId: {
            tenantId: "t1",
            externalSource: "SQUARE",
            externalId: "sq-item-1",
          },
        },
        create: expect.objectContaining({
          id: "test-id-123",
          tenantId: "t1",
          ...mapping,
        }),
        update: expect.objectContaining({
          internalType: "MenuItem",
          internalId: "item-1",
          externalType: "ITEM",
        }),
      });
    });
  });

  describe("softDeleteConnection", () => {
    it("should soft delete a connection", async () => {
      mockPrisma.integrationConnection.update.mockResolvedValue({} as never);

      await repo.softDeleteConnection("conn-1");

      expect(mockPrisma.integrationConnection.update).toHaveBeenCalledWith({
        where: { id: "conn-1" },
        data: { deleted: true, status: "inactive" },
      });
    });
  });

  describe("updateTokens", () => {
    it("should update connection tokens", async () => {
      const tokens = {
        accessToken: "new-access",
        refreshToken: "new-refresh",
        tokenExpiresAt: new Date("2026-06-08"),
      };
      mockPrisma.integrationConnection.update.mockResolvedValue({} as never);

      await repo.updateTokens("conn-1", tokens);

      expect(mockPrisma.integrationConnection.update).toHaveBeenCalledWith({
        where: { id: "conn-1" },
        data: tokens,
      });
    });
  });
});
