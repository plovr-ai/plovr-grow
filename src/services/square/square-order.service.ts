import crypto from "crypto";
import { SquareClient, SquareEnvironment } from "square";
import type {
  OrderLineItem,
  OrderLineItemModifier,
  Fulfillment,
  FulfillmentState,
} from "square";
import { squareConfig } from "./square.config";
import { integrationRepository } from "@/repositories/integration.repository";
import prisma from "@/lib/db";
import { AppError, ErrorCodes } from "@/lib/errors";
import type {
  SquareOrderPushInput,
  SquareOrderPushItem,
  SquareOrderPushResult,
} from "./square.types";
import {
  FULFILLMENT_STATUS_MAP,
  SQUARE_FULFILLMENT_TYPE_BY_ORDER_MODE,
  SQUARE_ORDER_SYNC_TYPE,
} from "./square.types";

const INTEGRATION_TYPE = "POS_SQUARE";

/**
 * Service for pushing internal orders to Square POS.
 *
 * Handles:
 * - Creating orders on Square with line items, modifiers, and fulfillment
 * - Updating fulfillment state when order status changes
 * - Canceling orders on Square
 * - Idempotency key generation (deterministic UUID from tenant/merchant/orderId)
 * - ID mapping resolution (internal item IDs to Square catalog object IDs)
 */
export class SquareOrderService {
  private getClient(accessToken: string): SquareClient {
    return new SquareClient({
      token: accessToken,
      environment:
        squareConfig.environment === "production"
          ? SquareEnvironment.Production
          : SquareEnvironment.Sandbox,
    });
  }

  /**
   * Push an internal order to Square.
   * Creates a Square order with line items, modifiers, and pickup fulfillment.
   */
  async createOrder(
    tenantId: string,
    merchantId: string,
    input: SquareOrderPushInput
  ): Promise<SquareOrderPushResult> {
    const { connection, accessToken } = await this.getConnectionAndToken(
      tenantId,
      merchantId
    );

    const locationId = connection.externalLocationId;
    if (!locationId) {
      throw new AppError(ErrorCodes.SQUARE_MISSING_LOCATION, undefined, 400);
    }

    // Resolve internal item IDs to Square catalog IDs
    const externalIdMap = await this.resolveExternalIds(tenantId, input.items);

    // Build line items
    const lineItems = this.buildLineItems(input.items, externalIdMap);

    // Build fulfillment
    const fulfillment = this.buildFulfillment(input);

    // Generate deterministic idempotency key
    const idempotencyKey = this.generateIdempotencyKey(
      tenantId,
      merchantId,
      input.orderId
    );

    // Create sync record for tracking
    const syncRecord = await integrationRepository.createSyncRecord(
      tenantId,
      connection.id,
      SQUARE_ORDER_SYNC_TYPE
    );

    try {
      const client = this.getClient(accessToken);
      const response = await client.orders.create({
        idempotencyKey,
        order: {
          locationId,
          referenceId: input.orderId,
          lineItems,
          fulfillments: [fulfillment],
          ticketName: input.orderNumber,
          metadata: {
            plovr_order_id: input.orderId,
            plovr_order_number: input.orderNumber,
          },
        },
      });

      const squareOrder = response.order;
      if (!squareOrder?.id) {
        throw new Error("Square API returned no order ID");
      }

      // Store the Square order ID mapping
      await integrationRepository.upsertIdMapping(tenantId, {
        internalType: "Order",
        internalId: input.orderId,
        externalSource: "SQUARE",
        externalType: "ORDER",
        externalId: squareOrder.id,
      });

      // Persist the initial Square order version so subsequent webhook
      // handlers can detect out-of-order updates (#109).
      await prisma.order.update({
        where: { id: input.orderId },
        data: { squareOrderVersion: Number(squareOrder.version ?? 1) },
      });

      // Update sync record as successful
      await integrationRepository.updateSyncRecord(syncRecord.id, {
        status: "success",
        objectsSynced: 1,
        objectsMapped: 1,
      });

      return {
        squareOrderId: squareOrder.id,
        squareVersion: squareOrder.version ?? 1,
      };
    } catch (error) {
      await integrationRepository.updateSyncRecord(syncRecord.id, {
        status: "failed",
        errorMessage:
          error instanceof Error ? error.message : "Unknown error",
      });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(ErrorCodes.SQUARE_ORDER_PUSH_FAILED, undefined, 500);
    }
  }

  /**
   * Update the fulfillment state of a Square order.
   * Maps internal fulfillment status to Square FulfillmentState.
   */
  async updateOrderStatus(
    tenantId: string,
    merchantId: string,
    orderId: string,
    fulfillmentStatus: string
  ): Promise<void> {
    const squareFulfillmentState = FULFILLMENT_STATUS_MAP[fulfillmentStatus];
    if (!squareFulfillmentState) {
      // Unknown status, skip silently
      return;
    }

    const { accessToken } = await this.getConnectionAndToken(
      tenantId,
      merchantId
    );

    // Look up the Square order ID from our mapping
    const orderMapping = await integrationRepository.getIdMappingByInternalId(
      tenantId,
      "SQUARE",
      "Order",
      orderId,
      "ORDER"
    );

    if (!orderMapping) {
      // Order was never pushed to Square, skip silently
      return;
    }

    try {
      const client = this.getClient(accessToken);

      // Get current order to find fulfillment UID and version
      const getResponse = await client.orders.get({
        orderId: orderMapping.externalId,
      });

      const squareOrder = getResponse.order;
      if (!squareOrder) {
        throw new AppError(ErrorCodes.SQUARE_ORDER_NOT_FOUND, undefined, 404);
      }

      const fulfillmentUid = squareOrder.fulfillments?.[0]?.uid;
      if (!fulfillmentUid) {
        return; // No fulfillment to update
      }

      await client.orders.update({
        orderId: orderMapping.externalId,
        order: {
          locationId: squareOrder.locationId,
          version: squareOrder.version,
          fulfillments: [
            {
              uid: fulfillmentUid,
              state: squareFulfillmentState as FulfillmentState,
            },
          ],
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        ErrorCodes.SQUARE_ORDER_UPDATE_FAILED,
        undefined,
        500
      );
    }
  }

  /**
   * Cancel an order on Square.
   * Updates the fulfillment state to CANCELED with an optional reason.
   */
  async cancelOrder(
    tenantId: string,
    merchantId: string,
    orderId: string,
    reason?: string
  ): Promise<void> {
    const { accessToken } = await this.getConnectionAndToken(
      tenantId,
      merchantId
    );

    // Look up the Square order ID from our mapping
    const orderMapping = await integrationRepository.getIdMappingByInternalId(
      tenantId,
      "SQUARE",
      "Order",
      orderId,
      "ORDER"
    );

    if (!orderMapping) {
      // Order was never pushed to Square, skip silently
      return;
    }

    try {
      const client = this.getClient(accessToken);

      // Get current order to find fulfillment UID and version
      const getResponse = await client.orders.get({
        orderId: orderMapping.externalId,
      });

      const squareOrder = getResponse.order;
      if (!squareOrder) {
        throw new AppError(ErrorCodes.SQUARE_ORDER_NOT_FOUND, undefined, 404);
      }

      const fulfillmentUid = squareOrder.fulfillments?.[0]?.uid;
      if (!fulfillmentUid) {
        return; // No fulfillment to cancel
      }

      const fulfillmentUpdate: Fulfillment = {
        uid: fulfillmentUid,
        state: "CANCELED",
      };

      // Attach the cancel reason to the correct details field based on
      // the Square fulfillment type. Square caps cancelReason at 100 chars.
      if (reason) {
        const truncated = reason.slice(0, 100);
        const fulfillmentType = squareOrder.fulfillments?.[0]?.type;
        if (fulfillmentType === "PICKUP") {
          fulfillmentUpdate.pickupDetails = { cancelReason: truncated };
        } else if (fulfillmentType === "DELIVERY") {
          fulfillmentUpdate.deliveryDetails = { cancelReason: truncated };
        }
      }

      await client.orders.update({
        orderId: orderMapping.externalId,
        order: {
          locationId: squareOrder.locationId,
          version: squareOrder.version,
          fulfillments: [fulfillmentUpdate],
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        ErrorCodes.SQUARE_ORDER_CANCEL_FAILED,
        undefined,
        500
      );
    }
  }

  // ==================== Private Helpers ====================

  /**
   * Build Square line items from internal order items.
   * Maps internal item IDs to Square catalog variation IDs via ExternalIdMapping.
   */
  private buildLineItems(
    items: SquareOrderPushItem[],
    externalIdMap: Map<string, string>
  ): OrderLineItem[] {
    return items.map((item) => {
      const catalogObjectId = externalIdMap.get(item.menuItemId);

      const modifiers: OrderLineItemModifier[] = item.selectedModifiers.map(
        (mod) => {
          const modExternalId = externalIdMap.get(mod.modifierId);
          return {
            catalogObjectId: modExternalId ?? undefined,
            name: mod.modifierName,
            quantity: String(mod.quantity),
            basePriceMoney: {
              amount: BigInt(Math.round(mod.price * 100)),
              currency: "USD",
            },
          };
        }
      );

      const lineItem: OrderLineItem = {
        quantity: String(item.quantity),
        name: item.name,
        basePriceMoney: {
          amount: BigInt(Math.round(item.price * 100)),
          currency: "USD",
        },
        note: item.specialInstructions ?? undefined,
        modifiers: modifiers.length > 0 ? modifiers : undefined,
      };

      // If we have a catalog mapping, link to the Square catalog
      if (catalogObjectId) {
        lineItem.catalogObjectId = catalogObjectId;
      }

      return lineItem;
    });
  }

  /**
   * Build a Square fulfillment from the order input.
   *
   * Maps our internal `OrderMode` to Square's fulfillment type:
   * - `pickup` → PICKUP with pickup details
   * - `delivery` → DELIVERY with recipient address (throws if address missing)
   * - `dine_in` → PICKUP (Square has no dine-in type); the note is prefixed
   *   with "Dine-in" so POS operators can still recognize the intent.
   */
  private buildFulfillment(input: SquareOrderPushInput): Fulfillment {
    const displayName =
      `${input.customerFirstName} ${input.customerLastName}`.trim();
    const squareType = SQUARE_FULFILLMENT_TYPE_BY_ORDER_MODE[input.orderMode];

    if (input.orderMode === "delivery") {
      if (!input.deliveryAddress) {
        throw new AppError(
          ErrorCodes.SQUARE_MISSING_DELIVERY_ADDRESS,
          undefined,
          400
        );
      }
      const addr = input.deliveryAddress;
      return {
        type: squareType,
        state: "PROPOSED",
        deliveryDetails: {
          scheduleType: "ASAP",
          recipient: {
            displayName,
            phoneNumber: input.customerPhone,
            emailAddress: input.customerEmail ?? undefined,
            address: {
              addressLine1: addr.street,
              addressLine2: addr.apt ?? undefined,
              locality: addr.city,
              administrativeDistrictLevel1: addr.state,
              postalCode: addr.zipCode,
              country: "US",
              firstName: input.customerFirstName || undefined,
              lastName: input.customerLastName || undefined,
            },
          },
          note: this.buildFulfillmentNote(input),
        },
      };
    }

    return {
      type: squareType,
      state: "PROPOSED",
      pickupDetails: {
        scheduleType: "ASAP",
        recipient: {
          displayName,
          phoneNumber: input.customerPhone,
          emailAddress: input.customerEmail ?? undefined,
        },
        note: this.buildFulfillmentNote(input),
      },
    };
  }

  /**
   * Build the fulfillment note combining the order's customer notes with
   * any mode-specific context. For `dine_in` the result is prefixed with
   * `"Dine-in"` so Square POS operators can still recognize the intent;
   * for `delivery` any `deliveryAddress.instructions` (gate codes, drop-off
   * directions, etc.) are appended so drivers receive them on Square.
   */
  private buildFulfillmentNote(
    input: SquareOrderPushInput
  ): string | undefined {
    const parts: string[] = [];
    const base = input.notes?.trim();
    if (base) parts.push(base);

    if (input.orderMode === "delivery") {
      const instructions = input.deliveryAddress?.instructions?.trim();
      if (instructions) parts.push(instructions);
      return parts.length > 0 ? parts.join(" | ") : undefined;
    }

    if (input.orderMode === "dine_in") {
      return parts.length > 0 ? `Dine-in: ${parts.join(" | ")}` : "Dine-in";
    }

    return parts.length > 0 ? parts.join(" | ") : undefined;
  }

  /**
   * Generate a deterministic idempotency key from tenant, merchant, and order IDs.
   * Uses UUID v5 namespace-based approach for consistency.
   */
  generateIdempotencyKey(
    tenantId: string,
    merchantId: string,
    orderId: string
  ): string {
    const input = `${tenantId}:${merchantId}:${orderId}`;
    const hash = crypto.createHash("sha256").update(input).digest("hex");

    // Format as UUID v4-like string (deterministic)
    return [
      hash.slice(0, 8),
      hash.slice(8, 12),
      hash.slice(12, 16),
      hash.slice(16, 20),
      hash.slice(20, 32),
    ].join("-");
  }

  /**
   * Resolve internal item and modifier IDs to Square catalog external IDs.
   * Returns a map of internalId -> externalId (Square catalog object ID).
   */
  private async resolveExternalIds(
    tenantId: string,
    items: SquareOrderPushItem[]
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();

    // Collect all internal IDs we need to resolve
    const menuItemIds = items.map((item) => item.menuItemId);
    const modifierIds = items.flatMap((item) =>
      item.selectedModifiers.map((mod) => mod.modifierId)
    );

    // Batch lookup for menu items (map to ITEM_VARIATION for Square line items)
    if (menuItemIds.length > 0) {
      const itemMappings = await integrationRepository.getIdMappingsByInternalIds(
        tenantId,
        "SQUARE",
        "MenuItem",
        menuItemIds,
        "ITEM_VARIATION"
      );
      for (const mapping of itemMappings) {
        result.set(mapping.internalId, mapping.externalId);
      }
    }

    // Batch lookup for modifiers
    if (modifierIds.length > 0) {
      const modifierMappings =
        await integrationRepository.getIdMappingsByInternalIds(
          tenantId,
          "SQUARE",
          "MenuItem",
          modifierIds,
          "MODIFIER"
        );
      for (const mapping of modifierMappings) {
        result.set(mapping.internalId, mapping.externalId);
      }
    }

    return result;
  }

  /**
   * Get the Square connection and a valid access token for a merchant.
   */
  private async getConnectionAndToken(
    tenantId: string,
    merchantId: string
  ): Promise<{
    connection: {
      id: string;
      externalLocationId: string | null;
      accessToken: string | null;
      refreshToken: string | null;
      tokenExpiresAt: Date | null;
    };
    accessToken: string;
  }> {
    const connection = await integrationRepository.getConnection(
      tenantId,
      merchantId,
      INTEGRATION_TYPE
    );

    if (!connection) {
      throw new AppError(ErrorCodes.INTEGRATION_NOT_CONNECTED, undefined, 404);
    }

    if (!connection.accessToken) {
      throw new AppError(
        ErrorCodes.INTEGRATION_TOKEN_EXPIRED,
        undefined,
        401
      );
    }

    // Token refresh is handled by the parent SquareService.ensureValidToken
    // For order push, we trust the token is valid since it was recently checked
    return { connection, accessToken: connection.accessToken };
  }
}

export const squareOrderService = new SquareOrderService();
