import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import type { DbClient } from "@/lib/db";
import { generateEntityId } from "@/lib/id";
import type { CatalogSyncStats } from "./integration.types";

export interface UpsertConnectionInput {
  type: string;
  category: string;
  externalAccountId?: string;
  externalLocationId?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  scopes?: string;
}

export interface UpdateTokensInput {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
}

export interface UpsertIdMappingInput {
  internalType: string;
  internalId: string;
  externalSource: string;
  externalType: string;
  externalId: string;
}

const SYNC_STALE_MINUTES = 10;

export class IntegrationRepository {
  async getConnection(tenantId: string, merchantId: string, type: string) {
    return prisma.integrationConnection.findUnique({
      where: {
        tenantId_merchantId_type: { tenantId, merchantId, type },
        deleted: false,
      },
    });
  }

  async upsertConnection(
    tenantId: string,
    merchantId: string,
    data: UpsertConnectionInput,
    tx?: DbClient
  ) {
    const db = tx ?? prisma;
    return db.integrationConnection.upsert({
      where: {
        tenantId_merchantId_type: {
          tenantId,
          merchantId,
          type: data.type,
        },
      },
      create: {
        id: generateEntityId(),
        tenantId,
        merchantId,
        type: data.type,
        category: data.category,
        status: "active",
        externalAccountId: data.externalAccountId,
        externalLocationId: data.externalLocationId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
        scopes: data.scopes,
      },
      update: {
        status: "active",
        externalAccountId: data.externalAccountId,
        externalLocationId: data.externalLocationId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
        scopes: data.scopes,
        deleted: false,
      },
    });
  }

  async updateTokens(connectionId: string, data: UpdateTokensInput) {
    return prisma.integrationConnection.update({
      where: { id: connectionId },
      data: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
      },
    });
  }

  async softDeleteConnection(connectionId: string) {
    return prisma.integrationConnection.update({
      where: { id: connectionId },
      data: { deleted: true, status: "inactive" },
    });
  }

  async createSyncRecord(
    tenantId: string,
    connectionId: string,
    syncType: string
  ) {
    return prisma.integrationSyncRecord.create({
      data: {
        id: generateEntityId(),
        tenantId,
        connectionId,
        syncType,
        status: "running",
        startedAt: new Date(),
      },
    });
  }

  async updateSyncRecord(
    recordId: string,
    data: {
      status: string;
      objectsSynced?: number;
      objectsMapped?: number;
      errorMessage?: string;
      cursor?: string;
    },
    stats?: CatalogSyncStats
  ) {
    const prismaData: Prisma.IntegrationSyncRecordUpdateInput = {
      ...data,
      finishedAt: data.status !== "running" ? new Date() : undefined,
    };

    if (stats) {
      const truncated: CatalogSyncStats = {
        ...stats,
        warnings: stats.warnings.slice(0, 100),
      };
      prismaData.stats = truncated as unknown as Prisma.InputJsonValue;
    }

    return prisma.integrationSyncRecord.update({
      where: { id: recordId },
      data: prismaData,
    });
  }

  async getRunningSync(connectionId: string) {
    const staleThreshold = new Date(
      Date.now() - SYNC_STALE_MINUTES * 60 * 1000
    );
    return prisma.integrationSyncRecord.findFirst({
      where: {
        connectionId,
        status: "running",
        startedAt: { gte: staleThreshold },
      },
    });
  }

  async upsertIdMapping(tenantId: string, data: UpsertIdMappingInput, tx?: DbClient) {
    const db = tx ?? prisma;
    return db.externalIdMapping.upsert({
      where: {
        tenantId_externalSource_externalId: {
          tenantId,
          externalSource: data.externalSource,
          externalId: data.externalId,
        },
      },
      create: {
        id: generateEntityId(),
        tenantId,
        internalType: data.internalType,
        internalId: data.internalId,
        externalSource: data.externalSource,
        externalType: data.externalType,
        externalId: data.externalId,
      },
      update: {
        internalType: data.internalType,
        internalId: data.internalId,
        externalType: data.externalType,
        deleted: false,
      },
    });
  }

  async getIdMappingsBySource(
    tenantId: string,
    externalSource: string,
    internalType?: string
  ) {
    return prisma.externalIdMapping.findMany({
      where: {
        tenantId,
        externalSource,
        ...(internalType && { internalType }),
        deleted: false,
      },
    });
  }

  async getIdMappingByExternalId(
    tenantId: string,
    externalSource: string,
    externalId: string
  ) {
    return prisma.externalIdMapping.findFirst({
      where: {
        tenantId,
        externalSource,
        externalId,
        deleted: false,
      },
    });
  }

  /**
   * Reverse lookup: find external ID by internal ID and type.
   * Used for order push to resolve internal item IDs to Square catalog IDs.
   */
  async getIdMappingByInternalId(
    tenantId: string,
    externalSource: string,
    internalType: string,
    internalId: string,
    externalType?: string
  ) {
    return prisma.externalIdMapping.findFirst({
      where: {
        tenantId,
        externalSource,
        internalType,
        internalId,
        ...(externalType && { externalType }),
        deleted: false,
      },
    });
  }

  /**
   * Batch reverse lookup: find external IDs for multiple internal IDs.
   * Optimized for order push where we need to resolve many items at once.
   */
  async getIdMappingsByInternalIds(
    tenantId: string,
    externalSource: string,
    internalType: string,
    internalIds: string[],
    externalType?: string
  ) {
    return prisma.externalIdMapping.findMany({
      where: {
        tenantId,
        externalSource,
        internalType,
        internalId: { in: internalIds },
        ...(externalType && { externalType }),
        deleted: false,
      },
    });
  }

  // ==================== Webhook Events ====================

  async getConnectionByExternalAccountId(
    externalAccountId: string,
    type: string
  ) {
    return prisma.integrationConnection.findFirst({
      where: {
        externalAccountId,
        type,
        deleted: false,
        status: "active",
      },
    });
  }

  async findWebhookEventByEventId(eventId: string) {
    return prisma.webhookEvent.findUnique({
      where: { eventId },
    });
  }

  async createWebhookEvent(data: {
    tenantId: string;
    merchantId: string;
    connectionId: string;
    eventId: string;
    eventType: string;
    payload: unknown;
  }) {
    return prisma.webhookEvent.create({
      data: {
        id: generateEntityId(),
        tenantId: data.tenantId,
        merchantId: data.merchantId,
        connectionId: data.connectionId,
        eventId: data.eventId,
        eventType: data.eventType,
        payload: data.payload as never,
        status: "received",
      },
    });
  }

  async updateWebhookEventStatus(
    id: string,
    status: string,
    errorMessage?: string
  ) {
    return prisma.webhookEvent.update({
      where: { id },
      data: {
        status,
        errorMessage,
        processedAt: status === "processed" || status === "failed" ? new Date() : undefined,
      },
    });
  }
}

export const integrationRepository = new IntegrationRepository();
