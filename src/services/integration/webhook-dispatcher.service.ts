import { integrationRepository } from "@/repositories/integration.repository";
import type { PosWebhookProvider } from "./pos-webhook-provider.interface";
import { computeNextRetryAt } from "@/lib/retry";
import { WEBHOOK_EVENT_STATUS } from "@/services/square/square.types";
import { logger } from "@/lib/logger";

export interface WebhookDispatchResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Unified webhook dispatcher — routes incoming webhooks to the correct
 * POS provider and runs the shared pipeline (dedup, connection lookup,
 * event tracking, error handling).
 */
export interface WebhookDispatcher {
  /** Register a webhook provider by its name (URL slug, e.g. "square"). */
  register(name: string, provider: PosWebhookProvider): void;
  /** Check whether a provider is registered. */
  hasProvider(name: string): boolean;
  /**
   * Dispatch an incoming webhook request through the unified pipeline:
   *
   * 1. Look up provider by name (→ 400 if unknown)
   * 2. Verify signature (→ 401 if invalid)
   * 3. Parse event
   * 4. Dedup check
   * 5. Connection lookup
   * 6. Create webhook event record
   * 7. Process via provider
   * 8. Update status (PROCESSED / schedule retry on failure)
   */
  dispatch(
    providerName: string,
    rawBody: string,
    headers: Record<string, string>
  ): Promise<WebhookDispatchResult>;
}

export function createWebhookDispatcher(): WebhookDispatcher {
  const providers = new Map<string, PosWebhookProvider>();

  function register(name: string, provider: PosWebhookProvider): void {
    providers.set(name, provider);
  }

  function hasProvider(name: string): boolean {
    return providers.has(name);
  }

  async function dispatch(
    providerName: string,
    rawBody: string,
    headers: Record<string, string>
  ): Promise<WebhookDispatchResult> {
    // 1. Provider lookup
    const provider = providers.get(providerName);
    if (!provider) {
      return {
        status: 400,
        body: { error: "unknown_provider" },
      };
    }

    // 2. Signature verification
    if (!provider.verifyWebhook(rawBody, headers)) {
      logger.error({ provider: providerName }, "Webhook signature verification failed");
      return {
        status: 401,
        body: { error: "invalid_signature" },
      };
    }

    // Signature is valid — always acknowledge with 200 from here on,
    // even if downstream processing fails. Returning 5xx would cause the
    // POS platform to retry the same payload indefinitely.
    try {
      // 3. Parse event
      const event = provider.parseWebhookEvent(rawBody);

      // 4. Connection lookup (before dedup so we can scope dedup by connection)
      const connection =
        await integrationRepository.getConnectionByExternalAccountId(
          event.externalAccountId,
          provider.type
        );
      if (!connection) {
        logger.error(
          { provider: providerName, externalAccountId: event.externalAccountId },
          "No connection found for external account"
        );
        return { status: 200, body: { received: true, error: "connection_not_found" } };
      }

      // 5. Dedup check — scoped by connection to avoid cross-provider collisions
      const existing = await integrationRepository.findWebhookEventByEventId(
        connection.id,
        event.eventId
      );
      if (existing) {
        logger.info(
          { provider: providerName, eventId: event.eventId },
          "Duplicate webhook event skipped"
        );
        return { status: 200, body: { received: true, deduplicated: true } };
      }

      // 6. Create webhook event record
      const webhookEvent = await integrationRepository.createWebhookEvent({
        tenantId: connection.tenantId,
        merchantId: connection.merchantId,
        connectionId: connection.id,
        eventId: event.eventId,
        eventType: event.eventType,
        payload: event.rawPayload,
      });

      // 7. Process via provider + 8. Update status
      try {
        await provider.handleWebhookEvent(event, {
          tenantId: connection.tenantId,
          merchantId: connection.merchantId,
          id: connection.id,
        });
        await integrationRepository.updateWebhookEventStatus(
          webhookEvent.id,
          WEBHOOK_EVENT_STATUS.PROCESSED
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        logger.error(
          { provider: providerName, eventType: event.eventType, error: errorMessage },
          "Webhook handler failed"
        );
        const nextRetryAt = computeNextRetryAt(0);
        await integrationRepository.scheduleWebhookEventRetry(
          webhookEvent.id,
          1,
          nextRetryAt,
          errorMessage
        );
      }
    } catch (error) {
      logger.error(
        { provider: providerName, error: error instanceof Error ? error.message : error },
        "Webhook pipeline error (acked)"
      );
    }

    return { status: 200, body: { received: true } };
  }

  return { register, hasProvider, dispatch };
}

export const webhookDispatcher = createWebhookDispatcher();
