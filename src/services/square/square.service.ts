import { squareConfig } from "./square.config";
import { squareOAuthService } from "./square-oauth.service";
import { squareCatalogService } from "./square-catalog.service";
import { squareOrderService } from "./square-order.service";
import { integrationRepository } from "@/repositories/integration.repository";
import { AppError, ErrorCodes } from "@/lib/errors";
import { generateEntityId } from "@/lib/id";
import prisma from "@/lib/db";
import type {
  SquareLocation,
  SquareConnectionStatus,
  SquareOrderPushInput,
  SquareOrderPushResult,
} from "./square.types";

const INTEGRATION_TYPE = "POS_SQUARE";
const INTEGRATION_CATEGORY = "POS";

export class SquareService {
  getAuthorizationUrl(
    tenantId: string,
    merchantId: string,
    returnUrl: string
  ): string {
    squareConfig.assertConfigured();
    return squareOAuthService.buildAuthorizationUrl(
      tenantId,
      merchantId,
      returnUrl
    );
  }

  async handleOAuthCallback(
    code: string,
    state: string
  ): Promise<{ returnUrl: string; locations: SquareLocation[] }> {
    const { tenantId, merchantId, returnUrl } =
      squareOAuthService.verifyAndParseState(state);

    const tokens = await squareOAuthService.exchangeCode(code);
    const locations = await squareOAuthService.listLocations(
      tokens.accessToken
    );

    // Store connection (upsert — idempotent for re-auth)
    await integrationRepository.upsertConnection(tenantId, merchantId, {
      type: INTEGRATION_TYPE,
      category: INTEGRATION_CATEGORY,
      externalAccountId: tokens.merchantId,
      externalLocationId: locations[0]?.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
      scopes: "ITEMS_READ MERCHANT_PROFILE_READ ORDERS_WRITE",
    });

    return { returnUrl, locations };
  }

  async getConnectionStatus(
    tenantId: string,
    merchantId: string
  ): Promise<SquareConnectionStatus> {
    const connection = await integrationRepository.getConnection(
      tenantId,
      merchantId,
      INTEGRATION_TYPE
    );

    if (!connection) {
      return { connected: false };
    }

    return {
      connected: true,
      externalAccountId: connection.externalAccountId ?? undefined,
      externalLocationId: connection.externalLocationId ?? undefined,
      tokenExpiresAt: connection.tokenExpiresAt ?? undefined,
    };
  }

  async disconnect(tenantId: string, merchantId: string): Promise<void> {
    const connection = await integrationRepository.getConnection(
      tenantId,
      merchantId,
      INTEGRATION_TYPE
    );
    if (!connection) {
      throw new AppError(ErrorCodes.INTEGRATION_NOT_CONNECTED, undefined, 404);
    }
    await integrationRepository.softDeleteConnection(connection.id);
  }

  async syncCatalog(
    tenantId: string,
    merchantId: string
  ): Promise<{ objectsSynced: number; objectsMapped: number }> {
    const connection = await integrationRepository.getConnection(
      tenantId,
      merchantId,
      INTEGRATION_TYPE
    );
    if (!connection) {
      throw new AppError(ErrorCodes.INTEGRATION_NOT_CONNECTED, undefined, 404);
    }

    // Concurrency guard
    const runningSync = await integrationRepository.getRunningSync(
      connection.id
    );
    if (runningSync) {
      throw new AppError(ErrorCodes.SQUARE_SYNC_ALREADY_RUNNING, undefined, 409);
    }

    // Ensure token is valid
    const accessToken = await this.ensureValidToken(connection);

    // Create sync record
    const syncRecord = await integrationRepository.createSyncRecord(
      tenantId,
      connection.id,
      "CATALOG_FULL"
    );

    try {
      // Fetch catalog from Square
      const rawCatalog = await squareCatalogService.fetchFullCatalog(
        accessToken
      );

      // Map to internal models
      const mapped = squareCatalogService.mapToMenuModels(rawCatalog);

      // Persist to database in a transaction
      await prisma.$transaction(async (tx) => {
        // Ensure a default menu exists
        let menu = await tx.menu.findFirst({
          where: { tenantId, deleted: false },
        });
        if (!menu) {
          menu = await tx.menu.create({
            data: {
              id: generateEntityId(),
              tenantId,
              name: "Main Menu",
              sortOrder: 0,
            },
          });
        }

        // Upsert categories
        const categoryIdMap = new Map<string, string>(); // externalId → internalId
        for (const cat of mapped.categories) {
          const existingMapping =
            await integrationRepository.getIdMappingByExternalId(
              tenantId,
              "SQUARE",
              cat.externalId
            );
          const internalId = existingMapping?.internalId ?? generateEntityId();

          await tx.menuCategory.upsert({
            where: { id: internalId },
            create: {
              id: internalId,
              tenantId,
              menuId: menu.id,
              name: cat.name,
              sortOrder: cat.sortOrder,
            },
            update: {
              name: cat.name,
              sortOrder: cat.sortOrder,
              deleted: false,
            },
          });

          categoryIdMap.set(cat.externalId, internalId);

          await integrationRepository.upsertIdMapping(
            tenantId,
            {
              internalType: "MenuCategory",
              internalId,
              externalSource: "SQUARE",
              externalType: "CATEGORY",
              externalId: cat.externalId,
            },
            tx
          );
        }

        // Upsert items
        for (const item of mapped.items) {
          const existingMapping =
            await integrationRepository.getIdMappingByExternalId(
              tenantId,
              "SQUARE",
              item.externalId
            );
          const internalId = existingMapping?.internalId ?? generateEntityId();

          await tx.menuItem.upsert({
            where: { id: internalId },
            create: {
              id: internalId,
              tenantId,
              name: item.name,
              description: item.description,
              price: item.price,
              modifiers: item.modifiers
                ? JSON.parse(JSON.stringify(item.modifiers))
                : null,
            },
            update: {
              name: item.name,
              description: item.description,
              price: item.price,
              modifiers: item.modifiers
                ? JSON.parse(JSON.stringify(item.modifiers))
                : null,
              deleted: false,
            },
          });

          // Link to categories
          for (const catExtId of item.categoryExternalIds) {
            const catInternalId = categoryIdMap.get(catExtId);
            if (!catInternalId) continue;

            const linkId = generateEntityId();
            await tx.menuCategoryItem.upsert({
              where: { id: linkId },
              create: {
                id: linkId,
                tenantId,
                categoryId: catInternalId,
                menuItemId: internalId,
                sortOrder: 0,
              },
              update: {
                deleted: false,
              },
            });
          }

          // ID mapping for item
          await integrationRepository.upsertIdMapping(
            tenantId,
            {
              internalType: "MenuItem",
              internalId,
              externalSource: "SQUARE",
              externalType: "ITEM",
              externalId: item.externalId,
            },
            tx
          );

          // ID mappings for variations
          for (const variation of item.variationMappings) {
            await integrationRepository.upsertIdMapping(
              tenantId,
              {
                internalType: "MenuItem",
                internalId,
                externalSource: "SQUARE",
                externalType: "ITEM_VARIATION",
                externalId: variation.externalId,
              },
              tx
            );
          }
        }

        // Upsert taxes
        for (const tax of mapped.taxes) {
          const existingMapping =
            await integrationRepository.getIdMappingByExternalId(
              tenantId,
              "SQUARE",
              tax.externalId
            );
          const internalId = existingMapping?.internalId ?? generateEntityId();

          await tx.taxConfig.upsert({
            where: { id: internalId },
            create: {
              id: internalId,
              tenantId,
              name: tax.name,
              inclusionType: tax.inclusionType,
            },
            update: {
              name: tax.name,
              inclusionType: tax.inclusionType,
              deleted: false,
            },
          });

          // Create merchant tax rate
          const rateId = generateEntityId();
          await tx.merchantTaxRate.upsert({
            where: { id: rateId },
            create: {
              id: rateId,
              merchantId,
              taxConfigId: internalId,
              rate: tax.percentage / 100,
            },
            update: {
              rate: tax.percentage / 100,
              deleted: false,
            },
          });

          await integrationRepository.upsertIdMapping(
            tenantId,
            {
              internalType: "TaxConfig",
              internalId,
              externalSource: "SQUARE",
              externalType: "TAX",
              externalId: tax.externalId,
            },
            tx
          );
        }
      });

      const objectsSynced =
        mapped.categories.length + mapped.items.length + mapped.taxes.length;
      const objectsMapped = objectsSynced;

      await integrationRepository.updateSyncRecord(
        syncRecord.id,
        {
          status: "success",
          objectsSynced,
          objectsMapped,
        },
        mapped.stats
      );

      return { objectsSynced, objectsMapped };
    } catch (error) {
      await integrationRepository.updateSyncRecord(syncRecord.id, {
        status: "failed",
        errorMessage:
          error instanceof Error ? error.message : "Unknown error",
      });
      throw new AppError(ErrorCodes.SQUARE_CATALOG_SYNC_FAILED, undefined, 500);
    }
  }

  // ==================== Order Push ====================

  /**
   * Push an order to Square POS.
   * Ensures token is valid before delegating to the order service.
   */
  async pushOrder(
    tenantId: string,
    merchantId: string,
    input: SquareOrderPushInput
  ): Promise<SquareOrderPushResult> {
    const connection = await integrationRepository.getConnection(
      tenantId,
      merchantId,
      INTEGRATION_TYPE
    );
    if (!connection) {
      throw new AppError(ErrorCodes.INTEGRATION_NOT_CONNECTED, undefined, 404);
    }

    // Ensure token is valid before pushing
    await this.ensureValidToken(connection);

    return squareOrderService.createOrder(tenantId, merchantId, input);
  }

  /**
   * Update order fulfillment status on Square.
   */
  async updateOrderStatus(
    tenantId: string,
    merchantId: string,
    orderId: string,
    fulfillmentStatus: string
  ): Promise<void> {
    const connection = await integrationRepository.getConnection(
      tenantId,
      merchantId,
      INTEGRATION_TYPE
    );
    if (!connection) {
      throw new AppError(ErrorCodes.INTEGRATION_NOT_CONNECTED, undefined, 404);
    }

    await this.ensureValidToken(connection);
    return squareOrderService.updateOrderStatus(
      tenantId,
      merchantId,
      orderId,
      fulfillmentStatus
    );
  }

  /**
   * Cancel an order on Square.
   */
  async cancelOrder(
    tenantId: string,
    merchantId: string,
    orderId: string,
    reason?: string
  ): Promise<void> {
    const connection = await integrationRepository.getConnection(
      tenantId,
      merchantId,
      INTEGRATION_TYPE
    );
    if (!connection) {
      throw new AppError(ErrorCodes.INTEGRATION_NOT_CONNECTED, undefined, 404);
    }

    await this.ensureValidToken(connection);
    return squareOrderService.cancelOrder(
      tenantId,
      merchantId,
      orderId,
      reason
    );
  }

  private async ensureValidToken(connection: {
    id: string;
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiresAt: Date | null;
  }): Promise<string> {
    if (!connection.accessToken) {
      throw new AppError(ErrorCodes.INTEGRATION_TOKEN_EXPIRED, undefined, 401);
    }

    // Check if token expires within 5 minutes
    const bufferMs = 5 * 60 * 1000;
    if (
      connection.tokenExpiresAt &&
      connection.tokenExpiresAt.getTime() < Date.now() + bufferMs
    ) {
      if (!connection.refreshToken) {
        throw new AppError(
          ErrorCodes.INTEGRATION_TOKEN_EXPIRED,
          undefined,
          401
        );
      }

      const newTokens = await squareOAuthService.refreshToken(
        connection.refreshToken
      );
      await integrationRepository.updateTokens(connection.id, {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        tokenExpiresAt: newTokens.expiresAt,
      });
      return newTokens.accessToken;
    }

    return connection.accessToken;
  }
}

export const squareService = new SquareService();
