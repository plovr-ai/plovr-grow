"use client";

import { useFormatPrice } from "@/hooks";

interface PriceSummaryProps {
  subtotal: number;
  taxAmount: number;
  deliveryFee: number;
  tipAmount: number;
  totalAmount: number;
}

export function PriceSummary({
  subtotal,
  taxAmount,
  deliveryFee,
  tipAmount,
  totalAmount,
}: PriceSummaryProps) {
  const formatPrice = useFormatPrice();

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
    </div>
  );
}
