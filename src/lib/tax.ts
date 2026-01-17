/**
 * Tax Calculation Utilities
 * 税费计算工具函数
 */

import type {
  RoundingMethod,
  TaxConfigData,
  TaxBreakdownItem,
} from "@/services/menu/tax-config.types";

/**
 * Item tax calculation result
 */
export interface ItemTaxResult {
  itemId: string;
  quantity: number;
  unitPrice: number;
  taxableAmount: number;
  taxRate: number;
  taxAmount: number;
  taxConfigId: string | null;
  taxConfigName: string | null;
}

/**
 * Apply rounding based on the specified method
 * Works on currency values (2 decimal places)
 */
export function applyRounding(value: number, method: RoundingMethod): number {
  switch (method) {
    case "always_round_up":
      return Math.ceil(value * 100) / 100;

    case "always_round_down":
      return Math.floor(value * 100) / 100;

    case "half_even": {
      // Banker's rounding: 0.5 rounds to nearest even
      const cents = value * 100;
      const floor = Math.floor(cents);
      const diff = cents - floor;

      // If exactly 0.5, round to even
      if (Math.abs(diff - 0.5) < 0.0001) {
        return (floor % 2 === 0 ? floor : floor + 1) / 100;
      }
      return Math.round(cents) / 100;
    }

    case "half_up":
    default:
      // Standard rounding
      return Math.round(value * 100) / 100;
  }
}

/**
 * Calculate tax for a single item
 * Formula: round(unitPrice * quantity * taxRate)
 */
export function calculateItemTax(
  itemId: string,
  unitPrice: number,
  quantity: number,
  taxConfig: TaxConfigData | null
): ItemTaxResult {
  const taxableAmount = unitPrice * quantity;

  if (!taxConfig || taxConfig.rate === 0) {
    return {
      itemId,
      quantity,
      unitPrice,
      taxableAmount,
      taxRate: 0,
      taxAmount: 0,
      taxConfigId: null,
      taxConfigName: null,
    };
  }

  const rawTax = taxableAmount * taxConfig.rate;
  const taxAmount = applyRounding(rawTax, taxConfig.roundingMethod);

  return {
    itemId,
    quantity,
    unitPrice,
    taxableAmount,
    taxRate: taxConfig.rate,
    taxAmount,
    taxConfigId: taxConfig.id,
    taxConfigName: taxConfig.name,
  };
}

/**
 * Calculate total tax for all items and group by tax config
 */
export function calculateOrderTax(
  items: Array<{
    itemId: string;
    unitPrice: number;
    quantity: number;
    taxConfig: TaxConfigData | null;
  }>
): {
  totalTaxAmount: number;
  itemTaxes: ItemTaxResult[];
  taxBreakdown: TaxBreakdownItem[];
} {
  const itemTaxes: ItemTaxResult[] = [];
  const breakdownMap = new Map<string | null, TaxBreakdownItem>();

  for (const item of items) {
    const result = calculateItemTax(
      item.itemId,
      item.unitPrice,
      item.quantity,
      item.taxConfig
    );
    itemTaxes.push(result);

    // Aggregate by tax config
    const key = item.taxConfig?.id ?? null;
    const existing = breakdownMap.get(key);

    if (existing) {
      existing.taxableAmount += result.taxableAmount;
      existing.taxAmount += result.taxAmount;
    } else {
      breakdownMap.set(key, {
        taxConfigId: key,
        taxConfigName: item.taxConfig?.name ?? "Tax-Free",
        taxRate: item.taxConfig?.rate ?? 0,
        taxableAmount: result.taxableAmount,
        taxAmount: result.taxAmount,
      });
    }
  }

  // Round the aggregated amounts
  const taxBreakdown = Array.from(breakdownMap.values()).map((item) => ({
    ...item,
    taxableAmount: Math.round(item.taxableAmount * 100) / 100,
    taxAmount: Math.round(item.taxAmount * 100) / 100,
  }));

  const totalTaxAmount = itemTaxes.reduce((sum, item) => sum + item.taxAmount, 0);

  return {
    totalTaxAmount: Math.round(totalTaxAmount * 100) / 100,
    itemTaxes,
    taxBreakdown,
  };
}
