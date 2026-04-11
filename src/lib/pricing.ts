/**
 * Pricing Calculation Module
 * 价格计算模块 - 解耦设计，不依赖 TaxConfig 数据源
 */

import { applyRounding } from "./tax";
import type {
  RoundingMethod,
  TaxInclusionType,
} from "@/services/menu/tax-config.types";

/**
 * 商品税率配置（直接传值）
 */
export interface ItemTaxConfig {
  rate: number;
  roundingMethod: RoundingMethod;
  inclusionType: TaxInclusionType;
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
  /**
   * Total tax for display and audit. Includes both additive and inclusive tax.
   * DO NOT use this to compute total — inclusive portion is already inside
   * `subtotal`. For total calculation, use `taxAmountAdditive`.
   */
  taxAmount: number;
  /** Additive tax (e.g. US sales tax). Added to `totalAmount`. */
  taxAmountAdditive: number;
  /**
   * Inclusive tax (e.g. VAT). Already inside `subtotal` via listed price.
   * UI should render as `Tax (included): $X.XX`. NOT added to `totalAmount`.
   */
  taxAmountInclusive: number;
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

  // 2. 计算 per-item 税费（支持 additive + inclusive 混合）
  let taxAmountAdditive = 0;
  let taxAmountInclusive = 0;
  for (const item of items) {
    const lineTotal = item.unitPrice * item.quantity;
    const taxes = (item.taxes || []).filter((t) => t.rate > 0);

    const sumInclusiveRate = taxes
      .filter((t) => t.inclusionType === "inclusive")
      .reduce((acc, t) => acc + t.rate, 0);
    const taxableBase =
      sumInclusiveRate > 0 ? lineTotal / (1 + sumInclusiveRate) : lineTotal;

    // Each tax line rounded independently before accumulation.
    // For multi-inclusive scenarios, sum may differ from (lineTotal - taxableBase)
    // by ±0.01 per line — intentional, preserves per-line breakdown for receipts.
    for (const tax of taxes) {
      const rawTax = taxableBase * tax.rate;
      const rounded = applyRounding(rawTax, tax.roundingMethod);
      if (tax.inclusionType === "inclusive") {
        taxAmountInclusive += rounded;
      } else {
        taxAmountAdditive += rounded;
      }
    }
  }
  taxAmountAdditive = roundPrice(taxAmountAdditive);
  taxAmountInclusive = roundPrice(taxAmountInclusive);
  const totalTaxAmount = roundPrice(taxAmountAdditive + taxAmountInclusive);

  // 3. 计算 fees（基于 subtotal，fees 不计税）
  const { feesAmount, feesBreakdown } = calculateFeesAmount(
    roundedSubtotal,
    fees
  );

  // 4. 计算 tip（基于 subtotal）
  const tipAmount = calculateTipAmount(roundedSubtotal, tip);

  // 5. 计算总额: Subtotal + AdditiveTax + Fees + Tip（inclusive tax 已含在 subtotal 中）
  const totalAmount = roundPrice(
    roundedSubtotal + taxAmountAdditive + feesAmount + tipAmount
  );

  return {
    subtotal: roundedSubtotal,
    taxAmount: totalTaxAmount,
    taxAmountAdditive,
    taxAmountInclusive,
    feesAmount,
    feesBreakdown,
    tipAmount,
    totalAmount,
  };
}

function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}
