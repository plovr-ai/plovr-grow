import { useMemo } from "react";
import {
  calculateOrderPricing,
  type PricingItem,
  type PricingResult,
  type TipInput,
  type FeeInput,
} from "@/lib/pricing";
import type { CartItem } from "@/types";

/**
 * Client-side pricing hook
 * 使用预填充的 taxes 数组计算价格
 *
 * @param items - 购物车商品列表
 * @param tip - Tip 输入，支持百分比或固定金额
 * @param fees - Fees 输入，支持百分比或固定金额
 */
export function usePricing(
  items: CartItem[],
  tip?: TipInput | null,
  fees?: FeeInput[] | null
): PricingResult {
  return useMemo(() => {
    // 转换为 PricingItem，使用预填充的 taxes 数组
    const pricingItems: PricingItem[] = items.map((item) => {
      const taxes = item.taxes || [];

      return {
        itemId: item.menuItemId,
        unitPrice: item.totalPrice / item.quantity,
        quantity: item.quantity,
        taxes: taxes.map((t) => ({
          rate: t.rate,
          roundingMethod: t.roundingMethod,
          inclusionType: t.inclusionType,
        })),
      };
    });

    return calculateOrderPricing(pricingItems, tip, fees);
  }, [items, tip, fees]);
}
