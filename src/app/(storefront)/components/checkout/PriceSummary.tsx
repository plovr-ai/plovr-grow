"use client";

import { useFormatPrice } from "@/hooks";

export interface FeeDisplayItem {
  id: string;
  displayName: string;
  amount: number;
}

interface PriceSummaryProps {
  subtotal: number;
  taxAmount: number;
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
  fees,
  deliveryFee,
  tipAmount,
  totalAmount,
  giftCardPayment = 0,
  orderMode,
}: PriceSummaryProps) {
  const formatPrice = useFormatPrice();

  const cashPayment = Math.max(0, totalAmount - giftCardPayment);

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-gray-600">
        <span>Subtotal</span>
        <span>{formatPrice(subtotal)}</span>
      </div>
      <div className="flex justify-between text-gray-600">
        <span>Tax</span>
        <span>{formatPrice(taxAmount)}</span>
      </div>
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
