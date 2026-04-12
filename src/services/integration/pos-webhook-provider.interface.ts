/**
 * Parsed webhook event — provider-agnostic representation of a webhook payload.
 */
export interface ParsedWebhookEvent {
  /** Provider-assigned unique event identifier (used for dedup). */
  eventId: string;
  /** Event type string, e.g. "catalog.version.updated". */
  eventType: string;
  /** External account ID that identifies the merchant on the provider side. */
  externalAccountId: string;
  /** Original raw payload, preserved for storage. */
  rawPayload: unknown;
}

/**
 * POS Webhook Provider interface — each POS integration implements this
 * to plug into the unified webhook dispatcher pipeline.
 */
export interface PosWebhookProvider {
  /** Provider type identifier matching IntegrationConnection.type, e.g. "POS_SQUARE". */
  readonly type: string;

  /**
   * Verify the webhook signature / authenticity.
   * Returns true if the request is legitimate.
   */
  verifyWebhook(rawBody: string, headers: Record<string, string>): boolean;

  /**
   * Parse the raw webhook body into a provider-agnostic event.
   */
  parseWebhookEvent(rawBody: string): ParsedWebhookEvent;

  /**
   * Handle the parsed webhook event (provider-specific business logic).
   * Called after dedup, connection lookup, and event record creation.
   */
  handleWebhookEvent(
    event: ParsedWebhookEvent,
    connection: { tenantId: string; merchantId: string; id: string }
  ): Promise<void>;
}
