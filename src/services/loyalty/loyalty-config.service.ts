import { loyaltyConfigRepository } from "@/repositories/loyalty-config.repository";
import type {
  LoyaltyConfigData,
  UpsertLoyaltyConfigInput,
} from "./loyalty.types";
import { toLoyaltyConfigData } from "./loyalty.types";

/**
 * Get loyalty config for a company
 */
async function getLoyaltyConfig(
  tenantId: string
): Promise<LoyaltyConfigData | null> {
  const config = await loyaltyConfigRepository.getByTenantId(tenantId);
  if (!config) return null;
  return toLoyaltyConfigData(config);
}

/**
 * Check if loyalty is enabled for a company
 */
async function isLoyaltyEnabled(tenantId: string): Promise<boolean> {
  const config = await loyaltyConfigRepository.getByTenantId(tenantId);
  return config?.status === "active";
}

/**
 * Get points per dollar configuration
 */
async function getPointsPerDollar(tenantId: string): Promise<number> {
  const config = await loyaltyConfigRepository.getByTenantId(tenantId);
  if (!config) return 1; // Default to 1 point per dollar
  return Number(config.pointsPerDollar);
}

/**
 * Create or update loyalty config
 */
async function upsertLoyaltyConfig(
  tenantId: string,
  input: UpsertLoyaltyConfigInput
): Promise<LoyaltyConfigData> {
  const config = await loyaltyConfigRepository.upsert(tenantId, {
    pointsPerDollar: input.pointsPerDollar,
    status: input.status,
  });
  return toLoyaltyConfigData(config);
}

/**
 * Enable loyalty program
 */
async function enableLoyalty(tenantId: string): Promise<void> {
  const existing = await loyaltyConfigRepository.getByTenantId(tenantId);
  if (existing) {
    await loyaltyConfigRepository.setStatus(tenantId, "active");
  } else {
    await loyaltyConfigRepository.create(tenantId, { status: "active" });
  }
}

/**
 * Disable loyalty program
 */
async function disableLoyalty(tenantId: string): Promise<void> {
  await loyaltyConfigRepository.setStatus(tenantId, "inactive");
}

/**
 * Set loyalty status (enable/disable)
 */
async function setLoyaltyStatus(
  tenantId: string,
  status: "active" | "inactive"
): Promise<void> {
  const existing = await loyaltyConfigRepository.getByTenantId(tenantId);
  if (existing) {
    await loyaltyConfigRepository.setStatus(tenantId, status);
  } else if (status === "active") {
    await loyaltyConfigRepository.create(tenantId, { status: "active" });
  }
}

export const loyaltyConfigService = {
  getLoyaltyConfig,
  isLoyaltyEnabled,
  getPointsPerDollar,
  upsertLoyaltyConfig,
  enableLoyalty,
  disableLoyalty,
  setLoyaltyStatus,
};
