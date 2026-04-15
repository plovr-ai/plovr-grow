import { AppError, ErrorCodes } from "@/lib/errors";
import { integrationRepository } from "@/repositories/integration.repository";
import type { PosProvider } from "./pos-provider.types";

/**
 * Registry for POS providers.
 *
 * Providers register themselves at server startup (instrumentation.ts).
 * The order-listener and other consumers look up providers by type string.
 */
class PosProviderRegistry {
  private providers = new Map<string, PosProvider>();

  /** Register a provider (keyed by provider.type). */
  register(provider: PosProvider): void {
    this.providers.set(provider.type, provider);
  }

  /** Get a provider by type, or throw if not registered. */
  getProvider(type: string): PosProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new AppError(ErrorCodes.POS_PROVIDER_NOT_FOUND, { type }, 500);
    }
    return provider;
  }

  /** Check whether a provider is registered. */
  hasProvider(type: string): boolean {
    return this.providers.has(type);
  }

  /** Get the active POS connection for a merchant (service-layer wrapper). */
  async getActivePosConnection(tenantId: string, merchantId: string) {
    return integrationRepository.getActivePosConnection(tenantId, merchantId);
  }
}

export const posProviderRegistry = new PosProviderRegistry();
