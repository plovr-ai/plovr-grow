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
 * Tax configuration data (Company level, without specific rate)
 * 税种定义（Company 级别，不含具体税率）
 */
export interface TaxConfigData {
  id: string;
  name: string;
  description: string | null;
  roundingMethod: RoundingMethod;
  status: "active" | "inactive";
}

/**
 * Merchant tax config (with specific rate for the merchant)
 * 门店税种配置（包含该门店的具体税率值）
 */
export interface MerchantTaxConfig {
  id: string; // taxConfigId
  name: string;
  rate: number; // 该门店的具体税率
  roundingMethod: RoundingMethod;
}

/**
 * Item tax info (for order calculation)
 * 菜品税种信息（用于订单计算）
 */
export interface ItemTaxInfo {
  taxConfigId: string;
  name: string;
  rate: number;
  roundingMethod: RoundingMethod;
}

/**
 * Tax configuration info (Company level, for Dashboard)
 */
export interface TaxConfigInfo {
  id: string;
  name: string;
  description: string | null;
  roundingMethod: RoundingMethod;
  status: "active" | "inactive";
}

/**
 * Merchant tax rate info
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
  merchantRates?: Array<{ merchantId: string; rate: number }>;
}

/**
 * Input for updating an existing tax config (with merchant rates)
 */
export interface UpdateTaxConfigInput {
  name?: string;
  description?: string;
  roundingMethod?: RoundingMethod;
  status?: "active" | "inactive";
  merchantRates?: Array<{ merchantId: string; rate: number }>;
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
