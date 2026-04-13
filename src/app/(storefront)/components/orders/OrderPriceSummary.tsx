"use client";

import { useTranslations } from "next-intl";
import { useFormatPrice } from "@/hooks";
import type { LoyaltyMember } from "@/contexts/LoyaltyContext";
import type { FeeBreakdownItem } from "@/lib/pricing";

interface Props {
  subtotal: number;
  taxAmount: number;
  tipAmount: number;
  deliveryFee: number;
  feesAmount: number;
  feesBreakdown: FeeBreakdownItem[];
  discount: number;
  totalAmount: number;
  pointsEarned?: number;
  member: LoyaltyMember | null;
}

export function OrderPriceSummary({
  subtotal,
  taxAmount,
  tipAmount,
  deliveryFee,
  feesAmount,
  feesBreakdown,
  discount,
  totalAmount,
  pointsEarned,
  member,
}: Props) {
  const formatPrice = useFormatPrice();
  const t = useTranslations("priceSummary");

  // Only show points if member is logged in and points were earned
  const showPoints = member !== null && pointsEarned && pointsEarned > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <h2 className="text-sm font-medium text-gray-700 mb-3">{t("title")}</h2>
      <div className="space-y-2">
        <div className="flex justify-between text-gray-600">
          <span>{t("subtotal")}</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>{t("tax")}</span>
          <span>{formatPrice(taxAmount)}</span>
        </div>
        {deliveryFee > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>{t("deliveryFee")}</span>
            <span>{formatPrice(deliveryFee)}</span>
          </div>
        )}
        {feesAmount > 0 && feesBreakdown.map((fee) => (
          <div key={fee.id} className="flex justify-between text-gray-600">
            <span>{t.has(`fees.${fee.id}`) ? t(`fees.${fee.id}`) : fee.id}</span>
            <span>{formatPrice(fee.amount)}</span>
          </div>
        ))}
        {tipAmount > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>{t("tip")}</span>
            <span>{formatPrice(tipAmount)}</span>
          </div>
        )}
        {discount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>{t("discount")}</span>
            <span>-{formatPrice(discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-semibold text-gray-900 pt-2 border-t border-gray-100">
          <span>{t("total")}</span>
          <span>{formatPrice(totalAmount)}</span>
        </div>
      </div>

      {/* Points Earned Badge (only visible for logged-in members with earned points) */}
      {showPoints && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
            <span className="text-lg">🎉</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-green-900">
                You earned {pointsEarned} points from this order!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
