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
 * Tax configuration data (for storefront, includes rate from MerchantTaxRate)
 */
export interface TaxConfigData {
  id: string;
  name: string;
  rate: number; // Decimal ratio (0.0825 for 8.25%) - from MerchantTaxRate
  roundingMethod: RoundingMethod;
  isDefault: boolean;
  status: "active" | "inactive";
}

/**
 * Tax configuration (Company level, without rate)
 */
export interface TaxConfigInfo {
  id: string;
  name: string;
  description: string | null;
  roundingMethod: RoundingMethod;
  isDefault: boolean;
  status: "active" | "inactive";
}

/**
 * Merchant tax rate
 */
export interface MerchantTaxRateInfo {
  merchantId: string;
  merchantName: string;
  rate: number; // Decimal ratio (0.0825 for 8.25%)
}

/**
 * Tax configuration with all merchant rates (for Dashboard)
 */
export interface TaxConfigWithRates extends TaxConfigInfo {
  merchantRates: MerchantTaxRateInfo[];
}

/**
 * Input for creating a new tax config (with merchant rates)
 */
export interface CreateTaxConfigInput {
  name: string;
  description?: string;
  roundingMethod: RoundingMethod;
  isDefault?: boolean;
  merchantRates?: Array<{ merchantId: string; rate: number }>;
}

/**
 * Input for updating an existing tax config (with merchant rates)
 */
export interface UpdateTaxConfigInput {
  name?: string;
  description?: string;
  roundingMethod?: RoundingMethod;
  isDefault?: boolean;
  status?: "active" | "inactive";
  merchantRates?: Array<{ merchantId: string; rate: number }>;
}

/**
 * Tax info for menu items and cart items
 */
export interface ItemTaxInfo {
  taxConfigId: string;
  name: string;
  rate: number; // Decimal ratio (0.0825 for 8.25%)
  roundingMethod: RoundingMethod;
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
