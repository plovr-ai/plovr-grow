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
  taxes: ItemTaxConfig[];
}

/**
 * Tip 输入类型 - 支持百分比和固定金额两种模式
 */
export type TipInput =
  | { type: "percentage"; percentage: number } // percentage: 0.15 = 15%
  | { type: "fixed"; amount: number };

/**
 * Fee 输入类型
 */
export interface FeeInput {
  id: string;
  type: "fixed" | "percentage";
  value: number; // fixed: 金额, percentage: 小数 (0.05 = 5%)
}

/**
 * Fee 明细项
 */
export interface FeeBreakdownItem {
  id: string;
  amount: number;
}

/**
 * 价格计算结果
 */
export interface PricingResult {
  subtotal: number;
  taxAmount: number;
  feesAmount: number;
  feesBreakdown: FeeBreakdownItem[];
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
 * 根据 subtotal 计算 fees 金额
 * percentage 类型基于 subtotal 计算
 */
function calculateFeesAmount(
  subtotal: number,
  fees: FeeInput[] | null | undefined
): { feesAmount: number; feesBreakdown: FeeBreakdownItem[] } {
  if (!fees || fees.length === 0) {
    return { feesAmount: 0, feesBreakdown: [] };
  }

  const breakdown: FeeBreakdownItem[] = [];
  let totalFees = 0;

  for (const fee of fees) {
    let amount: number;
    if (fee.type === "percentage") {
      amount = roundPrice(subtotal * fee.value);
    } else {
      amount = roundPrice(fee.value);
    }
    breakdown.push({ id: fee.id, amount });
    totalFees += amount;
  }

  return {
    feesAmount: roundPrice(totalFees),
    feesBreakdown: breakdown,
  };
}

/**
 * 计算订单价格
 * 可复用于 Checkout Page 和 Order Service
 *
 * 计算顺序: Subtotal → Tax → Fees → Tip → Total
 *
 * @param items - 商品列表
 * @param tip - Tip 输入，支持百分比或固定金额
 * @param fees - Fees 输入，支持百分比或固定金额
 */
export function calculateOrderPricing(
  items: PricingItem[],
  tip?: TipInput | null,
  fees?: FeeInput[] | null
): PricingResult {
  // 1. 计算商品小计
  const subtotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );
  const roundedSubtotal = roundPrice(subtotal);

  // 2. 计算 per-item 税费（支持多税种）
  let totalTaxAmount = 0;
  for (const item of items) {
    const taxableAmount = item.unitPrice * item.quantity;
    const taxes = item.taxes || [];
    for (const tax of taxes) {
      if (tax.rate > 0) {
        const rawTax = taxableAmount * tax.rate;
        totalTaxAmount += applyRounding(rawTax, tax.roundingMethod);
      }
    }
  }
  totalTaxAmount = roundPrice(totalTaxAmount);

  // 3. 计算 fees（基于 subtotal，fees 不计税）
  const { feesAmount, feesBreakdown } = calculateFeesAmount(
    roundedSubtotal,
    fees
  );

  // 4. 计算 tip（基于 subtotal）
  const tipAmount = calculateTipAmount(roundedSubtotal, tip);

  // 5. 计算总额: Subtotal + Tax + Fees + Tip
  const totalAmount = roundPrice(
    roundedSubtotal + totalTaxAmount + feesAmount + tipAmount
  );

  return {
    subtotal: roundedSubtotal,
    taxAmount: totalTaxAmount,
    feesAmount,
    feesBreakdown,
    tipAmount,
    totalAmount,
  };
}

function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}
