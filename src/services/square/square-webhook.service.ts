import crypto from "crypto";
import { squareConfig } from "./square.config";
import { integrationRepository } from "@/repositories/integration.repository";
import { squareService } from "./square.service";
import prisma from "@/lib/db";
import type { SquareWebhookPayload } from "./square.types";
import {
  REVERSE_FULFILLMENT_STATUS_MAP,
  FULFILLMENT_STATUS_RANK,
  WEBHOOK_EVENT_STATUS,
  WEBHOOK_RETRY_POLICY,
  computeNextRetryAt,
} from "./square.types";

const INTEGRATION_TYPE = "POS_SQUARE";

const FULFILLMENT_TIMESTAMP_FIELD: Record<string, string> = {
  confirmed: "confirmedAt",
  preparing: "preparingAt",
  ready: "readyAt",
  fulfilled: "fulfilledAt",
};

export class SquareWebhookService {
  verifySignature(rawBody: string, signature: string): boolean {
    if (!signature) return false;
    try {
      const hmac = crypto.createHmac(
        "sha256",
        squareConfig.webhookSignatureKey
      );
      hmac.update(squareConfig.webhookNotificationUrl + rawBody);
      const expected = hmac.digest("base64");
      const sigBuffer = Buffer.from(signature, "base64");
      const expectedBuffer = Buffer.from(expected, "base64");
      if (sigBuffer.length !== expectedBuffer.length) return false;
      return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    } catch {
      return false;
    }
  }

  async handleWebhook(
    rawBody: string
  ): Promise<{ deduplicated?: boolean; error?: string }> {
    const payload: SquareWebhookPayload = JSON.parse(rawBody);
    const { merchant_id, type: eventType, event_id: eventId } = payload;

    // Dedup check
    const existing =
      await integrationRepository.findWebhookEventByEventId(eventId);
    if (existing) {
      console.log(`[Square Webhook] Duplicate event skipped: ${eventId}`);
      return { deduplicated: true };
    }

    // Lookup connection
    const connection =
      await integrationRepository.getConnectionByExternalAccountId(
        merchant_id,
        INTEGRATION_TYPE
      );
    if (!connection) {
      console.error(
        `[Square Webhook] No connection found for Square merchant: ${merchant_id}`
      );
      return { error: "connection_not_found" };
    }

    // Store event
    const webhookEvent = await integrationRepository.createWebhookEvent({
      tenantId: connection.tenantId,
      merchantId: connection.merchantId,
      connectionId: connection.id,
      eventId,
      eventType,
      payload,
    });

    // Route to handler
    try {
      await this.routeEvent(eventType, payload, connection);
      await integrationRepository.updateWebhookEventStatus(
        webhookEvent.id,
        WEBHOOK_EVENT_STATUS.PROCESSED
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `[Square Webhook] Handler failed for ${eventType}:`,
        errorMessage
      );
      // First failure: schedule first retry. retryCount tracks how many
      // attempts have already been made (1 after this initial failure).
      const nextRetryAt = computeNextRetryAt(0);
      await integrationRepository.scheduleWebhookEventRetry(
        webhookEvent.id,
        1,
        nextRetryAt,
        errorMessage
      );
    }

    return { deduplicated: false };
  }

  /**
   * Retry failed webhook events whose next_retry_at has elapsed.
   * Uses exponential backoff; after WEBHOOK_RETRY_POLICY.MAX_RETRIES the
   * event is moved to dead_letter.
   *
   * Intended to be invoked from a scheduled cron endpoint.
   */
  async retryFailedEvents(
    batchSize: number = 20
  ): Promise<{ processed: number; retried: number; deadLettered: number }> {
    const events = await integrationRepository.findRetryableWebhookEvents(
      batchSize
    );

    let processed = 0;
    let retried = 0;
    let deadLettered = 0;

    for (const event of events) {
      const claimed = await integrationRepository.claimWebhookEventForRetry(
        event.id
      );
      if (!claimed) {
        continue;
      }

      const payload = event.payload as unknown as SquareWebhookPayload;
      const connection = {
        id: event.connectionId,
        tenantId: event.tenantId,
        merchantId: event.merchantId,
      };

      try {
        await this.routeEvent(event.eventType, payload, connection);
        await integrationRepository.markWebhookEventProcessed(event.id);
        processed += 1;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        const nextCount = event.retryCount + 1;
        console.error(
          `[Square Webhook] Retry ${nextCount}/${WEBHOOK_RETRY_POLICY.MAX_RETRIES} failed for ${event.eventType} (${event.id}):`,
          errorMessage
        );

        if (nextCount >= WEBHOOK_RETRY_POLICY.MAX_RETRIES) {
          await integrationRepository.markWebhookEventDeadLetter(
            event.id,
            errorMessage
          );
          deadLettered += 1;
        } else {
          const nextRetryAt = computeNextRetryAt(nextCount);
          await integrationRepository.scheduleWebhookEventRetry(
            event.id,
            nextCount,
            nextRetryAt,
            errorMessage
          );
          retried += 1;
        }
      }
    }

    return { processed, retried, deadLettered };
  }

  private async routeEvent(
    eventType: string,
    payload: SquareWebhookPayload,
    connection: { tenantId: string; merchantId: string; id: string }
  ): Promise<void> {
    switch (eventType) {
      case "catalog.version.updated":
        await this.handleCatalogChange(connection);
        break;
      case "order.updated":
        await this.handleOrderUpdate(payload, connection.tenantId);
        break;
      case "payment.completed":
      case "payment.updated":
        await this.handlePaymentEvent(payload, connection.tenantId);
        break;
      default:
        console.log(
          `[Square Webhook] Unhandled event type: ${eventType}`
        );
    }
  }

  private async handleCatalogChange(connection: {
    tenantId: string;
    merchantId: string;
  }): Promise<void> {
    const merchant = await prisma.merchant.findFirst({
      where: { id: connection.merchantId },
      select: { tenantId: true },
    });
    if (!merchant) {
      console.error(
        `[Square Webhook] Merchant not found: ${connection.merchantId}`
      );
      return;
    }
    console.log(
      `[Square Webhook] Triggering catalog re-sync for merchant: ${connection.merchantId}`
    );
    try {
      await squareService.syncCatalog(
        connection.tenantId,
        connection.merchantId
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("ALREADY_RUNNING")) {
        throw error;
      }
      console.log("[Square Webhook] Catalog sync already running, skipped");
    }
  }

  private async handleOrderUpdate(
    payload: SquareWebhookPayload,
    tenantId: string
  ): Promise<void> {
    const squareOrderId = payload.data.id;
    const orderObj = (
      payload.data.object as Record<string, unknown>
    )?.order as
      | {
          id: string;
          fulfillments?: Array<{
            state: string;
            pickup_details?: { cancel_reason?: string };
          }>;
        }
      | undefined;

    const fulfillment = orderObj?.fulfillments?.[0];
    const squareFulfillmentState = fulfillment?.state;
    if (!squareFulfillmentState) {
      console.log(
        "[Square Webhook] No fulfillment state in order update, skipping"
      );
      return;
    }

    const isCancellation =
      squareFulfillmentState === "CANCELED" ||
      squareFulfillmentState === "FAILED";
    if (
      !isCancellation &&
      !REVERSE_FULFILLMENT_STATUS_MAP[squareFulfillmentState]
    ) {
      console.log(
        `[Square Webhook] Unknown Square fulfillment state: ${squareFulfillmentState}`
      );
      return;
    }

    const mapping = await integrationRepository.getIdMappingByExternalId(
      tenantId,
      "SQUARE",
      squareOrderId
    );
    if (!mapping) {
      console.log(
        `[Square Webhook] No mapping for Square order: ${squareOrderId}, skipping`
      );
      return;
    }

    // Terminal cancellation states from Square — map straight to Order.status
    // = "canceled" regardless of fulfillment progress. Cancellation is
    // orthogonal to the forward rank and must be honored from any prior state.
    if (
      squareFulfillmentState === "CANCELED" ||
      squareFulfillmentState === "FAILED"
    ) {
      const current = await prisma.order.findUnique({
        where: { id: mapping.internalId },
        select: { status: true },
      });
      if (!current) {
        console.log(
          `[Square Webhook] Order not found for mapping: ${mapping.internalId}, skipping`
        );
        return;
      }
      if (current.status === "canceled") {
        // Idempotent: already canceled, nothing to do.
        return;
      }
      const cancelReason =
        fulfillment?.pickup_details?.cancel_reason?.trim() ||
        (squareFulfillmentState === "FAILED"
          ? "Fulfillment failed on Square"
          : "Canceled on Square POS");
      await prisma.order.update({
        where: { id: mapping.internalId },
        data: {
          status: "canceled",
          cancelledAt: new Date(),
          cancelReason,
        },
      });
      console.log(
        `[Square Webhook] Order ${mapping.internalId} canceled via Square (${squareFulfillmentState})`
      );
      return;
    }

    const internalStatus =
      REVERSE_FULFILLMENT_STATUS_MAP[squareFulfillmentState];

    // Monotonic guard: ignore reverse-mapped states that would walk the
    // order back to an earlier stage. The forward map collapses multiple
    // internal states onto the same Square state (e.g. confirmed + preparing
    // both become RESERVED), so the reverse map is inherently lossy and can
    // only be trusted when it advances the order.
    const current = await prisma.order.findUnique({
      where: { id: mapping.internalId },
      select: { fulfillmentStatus: true, status: true },
    });
    if (!current) {
      console.log(
        `[Square Webhook] Order not found for mapping: ${mapping.internalId}, skipping`
      );
      return;
    }
    // Do not resurrect a canceled order via a stale forward-progress webhook.
    if (current.status === "canceled") {
      return;
    }
    const currentRank = FULFILLMENT_STATUS_RANK[current.fulfillmentStatus] ?? -1;
    const incomingRank = FULFILLMENT_STATUS_RANK[internalStatus] ?? -1;
    if (incomingRank < currentRank) {
      console.log(
        `[Square Webhook] Ignoring regressive fulfillment state for ${mapping.internalId}: ${current.fulfillmentStatus} → ${internalStatus}`
      );
      return;
    }
    if (incomingRank === currentRank) {
      // Same status — nothing to write; avoid clobbering timestamps.
      return;
    }

    const timestampField = FULFILLMENT_TIMESTAMP_FIELD[internalStatus];
    const updateData: Record<string, unknown> = {
      fulfillmentStatus: internalStatus,
    };
    if (timestampField) {
      updateData[timestampField] = new Date();
    }

    await prisma.order.update({
      where: { id: mapping.internalId },
      data: updateData,
    });

    console.log(
      `[Square Webhook] Order ${mapping.internalId} fulfillment updated to: ${internalStatus}`
    );
  }

  private async handlePaymentEvent(
    payload: SquareWebhookPayload,
    tenantId: string
  ): Promise<void> {
    const paymentObj = (
      payload.data.object as Record<string, unknown>
    )?.payment as
      | { id: string; order_id?: string; status?: string }
      | undefined;

    const squareOrderId = paymentObj?.order_id;
    if (!squareOrderId) {
      console.log(
        "[Square Webhook] No order_id in payment event, skipping"
      );
      return;
    }

    const mapping = await integrationRepository.getIdMappingByExternalId(
      tenantId,
      "SQUARE",
      squareOrderId
    );
    if (!mapping) {
      console.log(
        `[Square Webhook] No mapping for Square order: ${squareOrderId}, skipping`
      );
      return;
    }

    const paymentStatus = paymentObj?.status;
    if (paymentStatus === "COMPLETED") {
      await prisma.order.update({
        where: { id: mapping.internalId },
        data: { status: "completed", paidAt: new Date() },
      });
      console.log(
        `[Square Webhook] Order ${mapping.internalId} payment completed`
      );
    } else if (paymentStatus === "FAILED") {
      await prisma.order.update({
        where: { id: mapping.internalId },
        data: {
          status: "canceled",
          cancelledAt: new Date(),
          cancelReason: "Payment failed on Square",
        },
      });
      console.log(
        `[Square Webhook] Order ${mapping.internalId} payment failed`
      );
    }
  }
}

export const squareWebhookService = new SquareWebhookService();
