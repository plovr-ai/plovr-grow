import crypto from "crypto";
import { squareConfig } from "./square.config";
import { squareWebhookService } from "./square-webhook.service";
import type {
  PosWebhookProvider,
  ParsedWebhookEvent,
} from "@/services/integration/pos-webhook-provider.interface";
import type { SquareWebhookPayload } from "./square.types";

const INTEGRATION_TYPE = "POS_SQUARE";

/**
 * Square implementation of the PosWebhookProvider interface.
 *
 * Delegates event routing to the existing SquareWebhookService which
 * retains all Square-specific business logic (catalog sync, order updates,
 * payment events).
 */
export class SquareWebhookProvider implements PosWebhookProvider {
  readonly type = INTEGRATION_TYPE;

  verifyWebhook(rawBody: string, headers: Record<string, string>): boolean {
    const signature = headers["x-square-hmacsha256-signature"] ?? "";
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

  parseWebhookEvent(rawBody: string): ParsedWebhookEvent {
    const payload: SquareWebhookPayload = JSON.parse(rawBody);
    return {
      eventId: payload.event_id,
      eventType: payload.type,
      externalAccountId: payload.merchant_id,
      rawPayload: payload,
    };
  }

  async handleWebhookEvent(
    event: ParsedWebhookEvent,
    connection: { tenantId: string; merchantId: string; id: string }
  ): Promise<void> {
    const payload = event.rawPayload as SquareWebhookPayload;
    await squareWebhookService.routeEvent(event.eventType, payload, connection);
  }
}

export const squareWebhookProvider = new SquareWebhookProvider();
