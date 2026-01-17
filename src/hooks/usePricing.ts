import { useMemo } from "react";
import {
  calculateOrderPricing,
  type PricingItem,
  type PricingResult,
  type TipInput,
  type FeeInput,
} from "@/lib/pricing";
import { getMockTaxConfigById } from "@/data/mock/tax-config";
import type { CartItem } from "@/types";

/**
 * Client-side pricing hook
 * 负责查找税率配置并嵌入到 PricingItem 中
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
    // 转换为 PricingItem，嵌入税率配置
    const pricingItems: PricingItem[] = items.map((item) => {
      const taxConfig = item.taxConfigId
        ? getMockTaxConfigById(item.taxConfigId)
        : null;

      return {
        itemId: item.menuItemId,
        unitPrice: item.totalPrice / item.quantity,
        quantity: item.quantity,
        tax: taxConfig
          ? { rate: taxConfig.rate, roundingMethod: taxConfig.roundingMethod }
          : null,
      };
    });

    return calculateOrderPricing(pricingItems, tip, fees);
  }, [items, tip, fees]);
}
