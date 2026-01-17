/**
 * Tax Configuration Types
 * 税率配置类型定义
 */

// Rounding methods for tax calculation
export const ROUNDING_METHODS = [
  "half_up", // Standard rounding (0.5 rounds up)
  "half_even", // Banker's rounding (0.5 rounds to nearest even)
  "always_round_up", // Ceiling
  "always_round_down", // Floor
] as const;

export type RoundingMethod = (typeof ROUNDING_METHODS)[number];

/**
 * Tax configuration data
 */
export interface TaxConfigData {
  id: string;
  name: string;
  rate: number; // Decimal ratio (0.0825 for 8.25%)
  roundingMethod: RoundingMethod;
  isDefault: boolean;
  status: "active" | "inactive";
}

/**
 * Input for creating a new tax config
 */
export interface CreateTaxConfigInput {
  name: string;
  rate: number;
  roundingMethod: RoundingMethod;
  isDefault?: boolean;
}

/**
 * Input for updating an existing tax config
 */
export interface UpdateTaxConfigInput {
  name?: string;
  rate?: number;
  roundingMethod?: RoundingMethod;
  isDefault?: boolean;
  status?: "active" | "inactive";
}

/**
 * Tax breakdown item for order summary
 */
export interface TaxBreakdownItem {
  taxConfigId: string | null;
  taxConfigName: string;
  taxRate: number;
  taxableAmount: number;
  taxAmount: number;
}
