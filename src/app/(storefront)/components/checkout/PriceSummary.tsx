"use client";

import { useTranslations } from "next-intl";
import { useFormatPrice } from "@/hooks";

export interface FeeDisplayItem {
  id: string;
  displayName: string;
  amount: number;
}

interface PriceSummaryProps {
  subtotal: number;
  taxAmount: number;
  taxAmountAdditive?: number;  // NEW — shown as normal additive tax row
  taxAmountInclusive?: number; // NEW — shown as "(included)" muted row, not added to total
  fees?: FeeDisplayItem[];
  deliveryFee: number;
  tipAmount: number;
  totalAmount: number;
  giftCardPayment?: number;
  orderMode?: string;
}

export function PriceSummary({
  subtotal,
  taxAmount,
  taxAmountAdditive,
  taxAmountInclusive,
  fees,
  deliveryFee,
  tipAmount,
  totalAmount,
  giftCardPayment = 0,
  orderMode,
}: PriceSummaryProps) {
  const t = useTranslations("priceSummary");
  const formatPrice = useFormatPrice();

  // Backwards-compat: if new fields not provided, treat all tax as additive
  const resolvedAdditive = taxAmountAdditive ?? taxAmount;
  const resolvedInclusive = taxAmountInclusive ?? 0;

  const cashPayment = Math.max(0, totalAmount - giftCardPayment);

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-gray-600">
        <span>Subtotal</span>
        <span>{formatPrice(subtotal)}</span>
      </div>
      {resolvedAdditive > 0 && (
        <div className="flex justify-between text-gray-600">
          <span>Tax</span>
          <span>{formatPrice(resolvedAdditive)}</span>
        </div>
      )}
      {resolvedInclusive > 0 && (
        <div className="flex justify-between text-gray-400">
          <span>{t("taxIncluded")}</span>
          <span>{formatPrice(resolvedInclusive)}</span>
        </div>
      )}
      {fees?.map((fee) => (
        <div key={fee.id} className="flex justify-between text-gray-600">
          <span>{fee.displayName}</span>
          <span>{formatPrice(fee.amount)}</span>
        </div>
      ))}
      {deliveryFee > 0 && (
        <div className="flex justify-between text-gray-600">
          <span>Delivery Fee</span>
          <span>{formatPrice(deliveryFee)}</span>
        </div>
      )}
      {tipAmount > 0 && (
        <div className="flex justify-between text-gray-600">
          <span>Tip</span>
          <span>{formatPrice(tipAmount)}</span>
        </div>
      )}
      <div className="flex justify-between text-lg font-semibold text-gray-900 pt-2 border-t border-gray-100">
        <span>Total</span>
        <span>{formatPrice(totalAmount)}</span>
      </div>

      {/* Gift Card Payment Section */}
      {giftCardPayment > 0 && (
        <>
          <div className="flex justify-between text-green-600 pt-2 border-t border-gray-100">
            <span>Gift Card</span>
            <span>-{formatPrice(giftCardPayment)}</span>
          </div>
          <div className="flex justify-between text-lg font-semibold text-gray-900">
            <span>
              {orderMode === "delivery" ? "Due at Delivery" : "Due at Pickup"}
            </span>
            <span>{formatPrice(cashPayment)}</span>
          </div>
        </>
      )}
    </div>
  );
}
