/**
 * Tax Calculation Utilities
 * 税费计算工具函数
 */

import type { RoundingMethod } from "@/services/menu/tax-config.types";

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
