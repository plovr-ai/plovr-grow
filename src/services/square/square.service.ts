import { squareConfig } from "./square.config";
import { squareOAuthService } from "./square-oauth.service";
import { squareCatalogService } from "./square-catalog.service";
import { squareOrderService } from "./square-order.service";
import { integrationRepository } from "@/repositories/integration.repository";
import { menuRepository } from "@/repositories/menu.repository";
import { menuEntityRepository } from "@/repositories/menu-entity.repository";
import { menuCategoryItemRepository } from "@/repositories/menu-category-item.repository";
import { taxConfigRepository } from "@/repositories/tax-config.repository";
import { modifierRepository } from "@/repositories/modifier.repository";
import { AppError, ErrorCodes } from "@/lib/errors";
import { generateEntityId } from "@/lib/id";
import { runInTransaction } from "@/lib/transaction";
import { menuService } from "@/services/menu";
import type { ModifierGroupInput, ModifierInput } from "@/services/menu/menu.types";
import type {
  SquareLocation,
  SquareConnectionStatus,
  SquareOrderPushInput,
  SquareOrderPushResult,
} from "./square.types";

const INTEGRATION_TYPE = "POS_SQUARE";
const INTEGRATION_CATEGORY = "POS";

async function ensureValidToken(connection: {
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

function getAuthorizationUrl(
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

async function handleOAuthCallback(
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

async function getConnectionStatus(
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

async function disconnect(tenantId: string, merchantId: string): Promise<void> {
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

async function syncCatalog(
  tenantId: string,
  merchantId: string,
  incremental: boolean = false
): Promise<{ objectsSynced: number; objectsMapped: number }> {
  const connection = await integrationRepository.getConnection(
    tenantId,
    merchantId,
    INTEGRATION_TYPE
  );
  if (!connection) {
    throw new AppError(ErrorCodes.INTEGRATION_NOT_CONNECTED, undefined, 404);
  }

  // Ensure token is valid
  const accessToken = await ensureValidToken(connection);

  // Determine if incremental sync is possible
  let useIncremental = incremental;
  let lastCursor: string | null = null;
  if (useIncremental) {
    lastCursor = await integrationRepository.getLastSuccessfulSyncCursor(
      connection.id,
      "CATALOG_FULL"
    );
    if (!lastCursor) {
      // No previous successful sync with cursor — fall back to full
      useIncremental = false;
    }
  }

  // Capture sync start time before fetching (to avoid missing changes during sync)
  const syncStartTime = new Date().toISOString();
  const syncType = useIncremental ? "CATALOG_INCREMENTAL" : "CATALOG_FULL";

  // Atomic concurrency guard + sync record creation.
  // Acquires FOR UPDATE lock on the connection row to serialize concurrent
  // sync attempts, then rejects if another running sync already exists.
  const syncRecord = await runInTransaction(async (tx) => {
    await integrationRepository.getConnectionForUpdate(connection.id, tx);

    const runningSync = await integrationRepository.getRunningSync(
      connection.id,
      tx
    );
    if (runningSync) {
      throw new AppError(
        ErrorCodes.SQUARE_SYNC_ALREADY_RUNNING,
        undefined,
        409
      );
    }
    return integrationRepository.createSyncRecord(
      tenantId,
      connection.id,
      syncType,
      tx
    );
  });

  try {
    // Fetch catalog from Square
    let rawCatalog;
    let deletedIds: string[] = [];

    if (useIncremental && lastCursor) {
      try {
        const incrementalResult = await squareCatalogService.fetchIncrementalCatalog(
          accessToken,
          lastCursor
        );
        rawCatalog = incrementalResult;
        deletedIds = incrementalResult.deletedIds;
      } catch (incrementalError) {
        // Fall back to full sync on incremental failure
        console.warn(
          "[Square Sync] Incremental sync failed, falling back to full sync:",
          incrementalError instanceof Error ? incrementalError.message : "Unknown error"
        );
        rawCatalog = await squareCatalogService.fetchFullCatalog(accessToken);
      }
    } else {
      rawCatalog = await squareCatalogService.fetchFullCatalog(accessToken);
    }

    // Map to internal models
    const mapped = squareCatalogService.mapToMenuModels(rawCatalog);

    // Persist to database in a transaction
    await runInTransaction(async (tx) => {
      // Ensure a default menu exists
      let menu = await menuEntityRepository.findDefaultMenu(tenantId, tx);
      if (!menu) {
        menu = await menuEntityRepository.createDefaultMenu(
          tenantId,
          "Main Menu",
          tx
        );
      }

      // Upsert categories
      const categoryIdMap = new Map<string, string>(); // externalId → internalId
      for (const cat of mapped.categories) {
        const existingMapping =
          await integrationRepository.getIdMappingByExternalId(
            tenantId,
            "SQUARE",
            cat.externalId,
            tx
          );
        const internalId = existingMapping?.internalId ?? generateEntityId();

        await menuRepository.upsertCategory(
          tenantId,
          menu.id,
          { id: internalId, name: cat.name, sortOrder: cat.sortOrder },
          tx
        );

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
            item.externalId,
            tx
          );
        const internalId = existingMapping?.internalId ?? generateEntityId();

        await menuRepository.upsertItem(
          tenantId,
          {
            id: internalId,
            name: item.name,
            description: item.description,
            price: item.price,
          },
          tx
        );

        // Link to categories
        for (const catExtId of item.categoryExternalIds) {
          const catInternalId = categoryIdMap.get(catExtId);
          if (!catInternalId) continue;

          await menuCategoryItemRepository.upsertLink(
            tenantId,
            catInternalId,
            internalId,
            tx
          );
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

        // ID mappings for variations — also create ModifierGroup/ModifierOption
        // for multi-variation items that produce a "variation group"
        for (const variation of item.variationMappings) {
          // If this variation is part of a modifier group (multi-variation),
          // create the ModifierOption and map it
          if (variation.groupId && variation.optionId) {
            await integrationRepository.upsertIdMapping(
              tenantId,
              {
                internalType: "ModifierOption",
                internalId: variation.optionId,
                externalSource: "SQUARE",
                externalType: "ITEM_VARIATION",
                externalId: variation.externalId,
              },
              tx
            );
          }
          // Keep backward-compat mapping: MenuItem → ITEM_VARIATION
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

        // Persist modifier groups via MenuService
        if (item.modifierGroups.length > 0) {
          // Resolve external IDs to internal IDs
          const resolvedGroups: ModifierGroupInput[] = [];

          for (let groupIdx = 0; groupIdx < item.modifierGroups.length; groupIdx++) {
            const group = item.modifierGroups[groupIdx];

            // Determine stable group ID via first option's external ID mapping
            const firstOptionExtId = group.options[0]?.externalId;
            let modifierGroupId: string | undefined;

            if (firstOptionExtId) {
              const existingOptionMapping =
                await integrationRepository.getIdMappingByExternalId(
                  tenantId,
                  "SQUARE",
                  firstOptionExtId,
                  tx
                );
              if (existingOptionMapping?.internalType === "ModifierOption") {
                const existingGroupId = await modifierRepository.getOptionGroupId(
                  existingOptionMapping.internalId,
                  tx
                );
                if (existingGroupId) {
                  modifierGroupId = existingGroupId;
                }
              }
            }

            if (!modifierGroupId) {
              modifierGroupId = generateEntityId();
            }

            // Resolve option IDs
            const resolvedModifiers: ModifierInput[] = [];
            for (let optIdx = 0; optIdx < group.options.length; optIdx++) {
              const opt = group.options[optIdx];
              const existingOptMapping =
                await integrationRepository.getIdMappingByExternalId(
                  tenantId,
                  "SQUARE",
                  opt.externalId,
                  tx
                );
              const optionId =
                (existingOptMapping?.internalType === "ModifierOption"
                  ? existingOptMapping?.internalId
                  : undefined) ?? generateEntityId();

              resolvedModifiers.push({
                id: optionId,
                name: opt.name,
                price: opt.price,
                isDefault: opt.isDefault,
                isAvailable: true,
              });

              // Create ModifierOption external ID mapping
              await integrationRepository.upsertIdMapping(
                tenantId,
                {
                  internalType: "ModifierOption",
                  internalId: optionId,
                  externalSource: "SQUARE",
                  externalType: "MODIFIER",
                  externalId: opt.externalId,
                },
                tx
              );
            }

            resolvedGroups.push({
              id: modifierGroupId,
              name: group.name,
              type: group.maxSelect === 1 ? "single" : "multiple",
              required: group.required,
              modifiers: resolvedModifiers,
            });
          }

          await menuService.syncModifierGroups(tenantId, internalId, resolvedGroups, tx);

          // Create ModifierGroup external ID mappings for MODIFIER_LIST types
          for (const rg of resolvedGroups) {
            const originalGroup = item.modifierGroups.find(
              (g) => g.name === rg.name && g.externalId
            );
            if (originalGroup?.externalId) {
              await integrationRepository.upsertIdMapping(
                tenantId,
                {
                  internalType: "ModifierGroup",
                  internalId: rg.id,
                  externalSource: "SQUARE",
                  externalType: "MODIFIER_LIST",
                  externalId: originalGroup.externalId,
                },
                tx
              );
            }
          }
        }
      }

      // Upsert taxes
      for (const tax of mapped.taxes) {
        const existingMapping =
          await integrationRepository.getIdMappingByExternalId(
            tenantId,
            "SQUARE",
            tax.externalId,
            tx
          );
        const internalId = existingMapping?.internalId ?? generateEntityId();

        await taxConfigRepository.upsertTaxConfig(
          tenantId,
          {
            id: internalId,
            name: tax.name,
            inclusionType: tax.inclusionType,
          },
          tx
        );

        // Create merchant tax rate
        await taxConfigRepository.upsertMerchantTaxRate(
          merchantId,
          internalId,
          tax.percentage / 100,
          tx
        );

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

      // Soft-delete objects that were deleted in Square (incremental sync only)
      for (const deletedExtId of deletedIds) {
        const mapping = await integrationRepository.getIdMappingByExternalId(
          tenantId,
          "SQUARE",
          deletedExtId,
          tx
        );
        if (!mapping) continue;

        switch (mapping.internalType) {
          case "MenuCategory":
            await menuRepository.softDeleteCategoryById(
              tenantId,
              mapping.internalId,
              tx
            );
            break;
          case "MenuItem":
            await menuRepository.softDeleteItemById(
              tenantId,
              mapping.internalId,
              tx
            );
            break;
          case "TaxConfig":
            await taxConfigRepository.softDeleteTaxConfig(
              tenantId,
              mapping.internalId,
              tx
            );
            await taxConfigRepository.softDeleteRatesByConfig(
              mapping.internalId,
              tx
            );
            break;
          case "ModifierGroup":
            await modifierRepository.softDeleteGroup(
              tenantId,
              mapping.internalId,
              tx
            );
            // Also soft-delete all options in this group
            await modifierRepository.softDeleteOptionsByGroup(
              mapping.internalId,
              tx
            );
            break;
        }

        // Mark the ID mapping as deleted
        await integrationRepository.softDeleteIdMapping(mapping.id, tx);
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
        cursor: syncStartTime,
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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new AppError(ErrorCodes.SQUARE_CATALOG_SYNC_FAILED, { message: errorMessage }, 500);
  }
}

// ==================== Order Push ====================

/**
 * Push an order to Square POS.
 * Ensures token is valid before delegating to the order service.
 */
async function pushOrder(
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
  await ensureValidToken(connection);

  return squareOrderService.createOrder(tenantId, merchantId, input);
}

/**
 * Update order fulfillment status on Square.
 */
async function updateOrderStatus(
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

  await ensureValidToken(connection);
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
async function cancelOrder(
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

  await ensureValidToken(connection);
  return squareOrderService.cancelOrder(
    tenantId,
    merchantId,
    orderId,
    reason
  );
}

export const squareService = {
  getAuthorizationUrl,
  handleOAuthCallback,
  getConnectionStatus,
  disconnect,
  syncCatalog,
  pushOrder,
  updateOrderStatus,
  cancelOrder,
};
