/**
 * Pricing Calculation Module
 * 价格计算模块 - 解耦设计，不依赖 TaxConfig 数据源
 */

import { applyRounding } from "./tax";
import type { RoundingMethod } from "@/services/menu/tax-config.types";

/**
 * 商品税率配置（直接传值）
 */
export interface ItemTaxConfig {
  rate: number;
  roundingMethod: RoundingMethod;
}

/**
 * 价格计算输入项
 */
export interface PricingItem {
  itemId: string;
  unitPrice: number;
  quantity: number;
  tax: ItemTaxConfig | null;
}

/**
 * Tip 输入类型 - 支持百分比和固定金额两种模式
 */
export type TipInput =
  | { type: "percentage"; percentage: number } // percentage: 0.15 = 15%
  | { type: "fixed"; amount: number };

/**
 * 价格计算结果
 */
export interface PricingResult {
  subtotal: number;
  taxAmount: number;
  tipAmount: number;
  totalAmount: number;
}

/**
 * 根据 subtotal 计算 tip 金额
 */
export function calculateTipAmount(
  subtotal: number,
  tip: TipInput | null | undefined
): number {
  if (!tip) return 0;

  if (tip.type === "percentage") {
    return roundPrice(subtotal * tip.percentage);
  }

  return roundPrice(tip.amount);
}

/**
 * 计算订单价格
 * 可复用于 Checkout Page 和 Order Service
 *
 * @param items - 商品列表
 * @param tip - Tip 输入，支持百分比或固定金额
 */
export function calculateOrderPricing(
  items: PricingItem[],
  tip?: TipInput | null
): PricingResult {
  // 1. 计算商品小计
  const subtotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );
  const roundedSubtotal = roundPrice(subtotal);

  // 2. 计算 per-item 税费
  let totalTaxAmount = 0;
  for (const item of items) {
    if (item.tax && item.tax.rate > 0) {
      const taxableAmount = item.unitPrice * item.quantity;
      const rawTax = taxableAmount * item.tax.rate;
      totalTaxAmount += applyRounding(rawTax, item.tax.roundingMethod);
    }
  }
  totalTaxAmount = roundPrice(totalTaxAmount);

  // 3. 计算 tip（基于 subtotal）
  const tipAmount = calculateTipAmount(roundedSubtotal, tip);

  // 4. 计算总额
  const totalAmount = roundPrice(roundedSubtotal + totalTaxAmount + tipAmount);

  return {
    subtotal: roundedSubtotal,
    taxAmount: totalTaxAmount,
    tipAmount,
    totalAmount,
  };
}

function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}
