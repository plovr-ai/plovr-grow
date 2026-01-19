"use client";

import { useFormatPrice } from "@/hooks";

interface Props {
  subtotal: number;
  taxAmount: number;
  tipAmount: number;
  deliveryFee: number;
  discount: number;
  totalAmount: number;
}

export function OrderPriceSummary({
  subtotal,
  taxAmount,
  tipAmount,
  deliveryFee,
  discount,
  totalAmount,
}: Props) {
  const formatPrice = useFormatPrice();

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <h2 className="text-sm font-medium text-gray-700 mb-3">Payment Summary</h2>
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
        {discount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount</span>
            <span>-{formatPrice(discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-semibold text-gray-900 pt-2 border-t border-gray-100">
          <span>Total</span>
          <span>{formatPrice(totalAmount)}</span>
        </div>
      </div>
    </div>
  );
}
