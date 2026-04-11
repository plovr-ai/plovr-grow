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
    webhookEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
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
  webhookEvent: {
    findUnique: MockedFn;
    create: MockedFn;
    update: MockedFn;
    updateMany: MockedFn;
    findMany: MockedFn;
  };
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

  describe("updateSyncRecord", () => {
    it("should update sync record with finishedAt for success status", async () => {
      mockPrisma.integrationSyncRecord.update.mockResolvedValue({} as never);

      await repo.updateSyncRecord("sync-1", {
        status: "success",
        objectsSynced: 10,
        objectsMapped: 10,
      });

      expect(mockPrisma.integrationSyncRecord.update).toHaveBeenCalledWith({
        where: { id: "sync-1" },
        data: expect.objectContaining({
          status: "success",
          objectsSynced: 10,
          objectsMapped: 10,
          finishedAt: expect.any(Date),
        }),
      });
    });

    it("should update sync record without finishedAt for running status", async () => {
      mockPrisma.integrationSyncRecord.update.mockResolvedValue({} as never);

      await repo.updateSyncRecord("sync-1", {
        status: "running",
        cursor: "next-page-token",
      });

      expect(mockPrisma.integrationSyncRecord.update).toHaveBeenCalledWith({
        where: { id: "sync-1" },
        data: expect.objectContaining({
          status: "running",
          cursor: "next-page-token",
          finishedAt: undefined,
        }),
      });
    });

    it("should update sync record with finishedAt for failed status", async () => {
      mockPrisma.integrationSyncRecord.update.mockResolvedValue({} as never);

      await repo.updateSyncRecord("sync-1", {
        status: "failed",
        errorMessage: "API timeout",
      });

      expect(mockPrisma.integrationSyncRecord.update).toHaveBeenCalledWith({
        where: { id: "sync-1" },
        data: expect.objectContaining({
          status: "failed",
          errorMessage: "API timeout",
          finishedAt: expect.any(Date),
        }),
      });
    });
  });

  describe("getIdMappingsBySource", () => {
    it("should find mappings by source", async () => {
      mockPrisma.externalIdMapping.findMany.mockResolvedValue([
        { internalId: "item-1", externalId: "sq-item-1" },
      ] as never);

      const result = await repo.getIdMappingsBySource("t1", "SQUARE");

      expect(mockPrisma.externalIdMapping.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: "t1",
          externalSource: "SQUARE",
          deleted: false,
        },
      });
      expect(result).toHaveLength(1);
    });

    it("should filter by internalType when provided", async () => {
      mockPrisma.externalIdMapping.findMany.mockResolvedValue([] as never);

      await repo.getIdMappingsBySource("t1", "SQUARE", "MenuItem");

      expect(mockPrisma.externalIdMapping.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: "t1",
          externalSource: "SQUARE",
          internalType: "MenuItem",
          deleted: false,
        },
      });
    });
  });

  describe("getIdMappingByExternalId", () => {
    it("should find mapping by external ID", async () => {
      mockPrisma.externalIdMapping.findFirst.mockResolvedValue({
        internalId: "item-1",
      } as never);

      const result = await repo.getIdMappingByExternalId("t1", "SQUARE", "sq-item-1");

      expect(mockPrisma.externalIdMapping.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: "t1",
          externalSource: "SQUARE",
          externalId: "sq-item-1",
          deleted: false,
        },
      });
      expect(result).toEqual({ internalId: "item-1" });
    });
  });

  describe("getIdMappingByInternalId", () => {
    it("should find mapping by internal ID", async () => {
      mockPrisma.externalIdMapping.findFirst.mockResolvedValue({
        externalId: "sq-item-1",
      } as never);

      const result = await repo.getIdMappingByInternalId(
        "t1", "SQUARE", "MenuItem", "item-1", "ITEM"
      );

      expect(mockPrisma.externalIdMapping.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: "t1",
          externalSource: "SQUARE",
          internalType: "MenuItem",
          internalId: "item-1",
          externalType: "ITEM",
          deleted: false,
        },
      });
      expect(result).toEqual({ externalId: "sq-item-1" });
    });

    it("should not include externalType filter when not provided", async () => {
      mockPrisma.externalIdMapping.findFirst.mockResolvedValue(null as never);

      await repo.getIdMappingByInternalId("t1", "SQUARE", "MenuItem", "item-1");

      expect(mockPrisma.externalIdMapping.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: "t1",
          externalSource: "SQUARE",
          internalType: "MenuItem",
          internalId: "item-1",
          deleted: false,
        },
      });
    });
  });

  describe("getIdMappingsByInternalIds", () => {
    it("should batch find mappings by internal IDs", async () => {
      mockPrisma.externalIdMapping.findMany.mockResolvedValue([
        { internalId: "item-1", externalId: "sq-var-1" },
      ] as never);

      const result = await repo.getIdMappingsByInternalIds(
        "t1", "SQUARE", "MenuItem", ["item-1", "item-2"], "ITEM_VARIATION"
      );

      expect(mockPrisma.externalIdMapping.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: "t1",
          externalSource: "SQUARE",
          internalType: "MenuItem",
          internalId: { in: ["item-1", "item-2"] },
          externalType: "ITEM_VARIATION",
          deleted: false,
        },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe("getConnectionByExternalAccountId", () => {
    it("should find connection by external account ID", async () => {
      mockPrisma.integrationConnection.findFirst.mockResolvedValue({
        id: "conn-1",
      } as never);

      const result = await repo.getConnectionByExternalAccountId("sq-acct-1", "POS_SQUARE");

      expect(mockPrisma.integrationConnection.findFirst).toHaveBeenCalledWith({
        where: {
          externalAccountId: "sq-acct-1",
          type: "POS_SQUARE",
          deleted: false,
          status: "active",
        },
      });
      expect(result).toEqual({ id: "conn-1" });
    });
  });

  describe("findWebhookEventByEventId", () => {
    it("should find webhook event by event ID", async () => {
      mockPrisma.webhookEvent.findUnique.mockResolvedValue({
        id: "wh-1",
        eventId: "evt_123",
      } as never);

      const result = await repo.findWebhookEventByEventId("evt_123");

      expect(mockPrisma.webhookEvent.findUnique).toHaveBeenCalledWith({
        where: { eventId: "evt_123" },
      });
      expect(result).toEqual({ id: "wh-1", eventId: "evt_123" });
    });
  });

  describe("createWebhookEvent", () => {
    it("should create a webhook event record", async () => {
      mockPrisma.webhookEvent.create.mockResolvedValue({ id: "test-id-123" } as never);

      await repo.createWebhookEvent({
        tenantId: "t1",
        merchantId: "m1",
        connectionId: "conn-1",
        eventId: "evt_123",
        eventType: "inventory.count.updated",
        payload: { data: "test" },
      });

      expect(mockPrisma.webhookEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: "test-id-123",
          tenantId: "t1",
          merchantId: "m1",
          connectionId: "conn-1",
          eventId: "evt_123",
          eventType: "inventory.count.updated",
          status: "received",
        }),
      });
    });
  });

  describe("updateWebhookEventStatus", () => {
    it("should update status to processed with processedAt", async () => {
      mockPrisma.webhookEvent.update.mockResolvedValue({} as never);

      await repo.updateWebhookEventStatus("wh-1", "processed");

      expect(mockPrisma.webhookEvent.update).toHaveBeenCalledWith({
        where: { id: "wh-1" },
        data: {
          status: "processed",
          errorMessage: undefined,
          processedAt: expect.any(Date),
        },
      });
    });

    it("should update status to failed with error message and processedAt", async () => {
      mockPrisma.webhookEvent.update.mockResolvedValue({} as never);

      await repo.updateWebhookEventStatus("wh-1", "failed", "Processing error");

      expect(mockPrisma.webhookEvent.update).toHaveBeenCalledWith({
        where: { id: "wh-1" },
        data: {
          status: "failed",
          errorMessage: "Processing error",
          processedAt: expect.any(Date),
        },
      });
    });

    it("should not set processedAt for received status", async () => {
      mockPrisma.webhookEvent.update.mockResolvedValue({} as never);

      await repo.updateWebhookEventStatus("wh-1", "received");

      expect(mockPrisma.webhookEvent.update).toHaveBeenCalledWith({
        where: { id: "wh-1" },
        data: {
          status: "received",
          errorMessage: undefined,
          processedAt: undefined,
        },
      });
    });
  });

  describe("scheduleWebhookEventRetry", () => {
    it("should update row for retry with retryCount and nextRetryAt", async () => {
      mockPrisma.webhookEvent.update.mockResolvedValue({} as never);
      const next = new Date("2026-04-12T00:05:00Z");

      await repo.scheduleWebhookEventRetry("wh-1", 2, next, "boom");

      expect(mockPrisma.webhookEvent.update).toHaveBeenCalledWith({
        where: { id: "wh-1" },
        data: {
          status: "failed",
          retryCount: 2,
          nextRetryAt: next,
          errorMessage: "boom",
          processedAt: expect.any(Date),
        },
      });
    });
  });

  describe("markWebhookEventDeadLetter", () => {
    it("should update row to dead_letter status and clear nextRetryAt", async () => {
      mockPrisma.webhookEvent.update.mockResolvedValue({} as never);

      await repo.markWebhookEventDeadLetter("wh-1", "gave up");

      expect(mockPrisma.webhookEvent.update).toHaveBeenCalledWith({
        where: { id: "wh-1" },
        data: {
          status: "dead_letter",
          errorMessage: "gave up",
          nextRetryAt: null,
          processedAt: expect.any(Date),
        },
      });
    });
  });

  describe("markWebhookEventProcessed", () => {
    it("should update row to processed and clear retry fields", async () => {
      mockPrisma.webhookEvent.update.mockResolvedValue({} as never);

      await repo.markWebhookEventProcessed("wh-1");

      expect(mockPrisma.webhookEvent.update).toHaveBeenCalledWith({
        where: { id: "wh-1" },
        data: {
          status: "processed",
          errorMessage: null,
          nextRetryAt: null,
          processedAt: expect.any(Date),
        },
      });
    });
  });

  describe("findRetryableWebhookEvents", () => {
    it("should query failed + processing rows whose nextRetryAt is due", async () => {
      mockPrisma.webhookEvent.findMany.mockResolvedValue([] as never);
      const now = new Date("2026-04-12T00:00:00Z");

      await repo.findRetryableWebhookEvents(10, now);

      expect(mockPrisma.webhookEvent.findMany).toHaveBeenCalledWith({
        where: {
          status: { in: ["failed", "processing"] },
          nextRetryAt: { lte: now },
        },
        orderBy: { nextRetryAt: "asc" },
        take: 10,
      });
    });
  });

  describe("claimWebhookEventForRetry", () => {
    it("should return true when a row is claimed", async () => {
      mockPrisma.webhookEvent.updateMany.mockResolvedValue({
        count: 1,
      } as never);
      const lease = new Date("2026-04-12T00:10:00Z");
      const now = new Date("2026-04-12T00:00:00Z");

      const result = await repo.claimWebhookEventForRetry("wh-1", lease, now);

      expect(result).toBe(true);
      expect(mockPrisma.webhookEvent.updateMany).toHaveBeenCalledWith({
        where: {
          id: "wh-1",
          status: { in: ["failed", "processing"] },
          nextRetryAt: { lte: now },
        },
        data: {
          status: "processing",
          nextRetryAt: lease,
        },
      });
    });

    it("should return false when no row was claimed (lost race)", async () => {
      mockPrisma.webhookEvent.updateMany.mockResolvedValue({
        count: 0,
      } as never);

      const result = await repo.claimWebhookEventForRetry(
        "wh-1",
        new Date(),
        new Date()
      );

      expect(result).toBe(false);
    });
  });
});
