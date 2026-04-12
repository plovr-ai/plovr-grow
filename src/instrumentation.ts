/**
 * Next.js instrumentation hook — runs once when the server starts.
 *
 * This is the central place to wire up event-handler registrations
 * and other one-time server-side initialization. Doing it here
 * (instead of as module side-effects) avoids circular dependencies
 * and prevents Vitest EnvironmentTeardownError.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only register event handlers on the Node.js server runtime
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerLoyaltyEventHandlers } = await import(
      "@/services/loyalty/loyalty-event-handler"
    );
    registerLoyaltyEventHandlers();

    // Register POS providers
    const { posProviderRegistry } = await import(
      "@/services/integration/pos-provider-registry"
    );
    const { squarePosProvider } = await import(
      "@/services/square/square-pos-provider"
    );
    posProviderRegistry.register(squarePosProvider);

    // Register webhook providers
    const { webhookDispatcher } = await import(
      "@/services/integration/webhook-dispatcher.service"
    );
    const { squareWebhookProvider } = await import(
      "@/services/square/square-webhook-provider"
    );
    webhookDispatcher.register("square", squareWebhookProvider);

    // Register POS-agnostic order event handlers
    const { registerOrderEventHandlers } = await import(
      "@/services/integration/order-listener"
    );
    registerOrderEventHandlers();
  }
}
