import type { TaxConfigData } from "@/services/menu/tax-config.types";

/**
 * Mock tax configurations for development
 */
export const mockTaxConfigs: TaxConfigData[] = [
  {
    id: "tax-standard",
    name: "Standard Tax",
    rate: 0.0825, // 8.25%
    roundingMethod: "half_up",
    isDefault: true,
    status: "active",
  },
  {
    id: "tax-alcohol",
    name: "Alcohol Tax",
    rate: 0.1, // 10%
    roundingMethod: "half_up",
    isDefault: false,
    status: "active",
  },
  {
    id: "tax-reduced",
    name: "Reduced Tax",
    rate: 0.05, // 5%
    roundingMethod: "always_round_down",
    isDefault: false,
    status: "active",
  },
];

/**
 * Get all active tax configs
 */
export function getMockTaxConfigs(): TaxConfigData[] {
  return mockTaxConfigs.filter((c) => c.status === "active");
}

/**
 * Get a single tax config by ID
 */
export function getMockTaxConfigById(id: string): TaxConfigData | undefined {
  return mockTaxConfigs.find((c) => c.id === id);
}
