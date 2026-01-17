"use client";

import Link from "next/link";
import { useFormatPrice } from "@/hooks";
import type { CartItem } from "@/types";

interface OrderSummaryProps {
  items: CartItem[];
  /** @deprecated Use merchantSlug instead */
  tenantSlug?: string;
  merchantSlug?: string;
}

export function OrderSummary({
  items,
  tenantSlug,
  merchantSlug,
}: OrderSummaryProps) {
  const formatPrice = useFormatPrice();
  const itemCount = items.reduce((count, item) => count + item.quantity, 0);

  // Support both old (tenantSlug) and new (merchantSlug) props
  const slug = merchantSlug ?? tenantSlug ?? "";

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-gray-700">
          Your Order ({itemCount} {itemCount === 1 ? "item" : "items"})
        </h2>
        <Link
          href={`/r/${slug}/cart`}
          className="text-sm text-theme-primary hover:text-theme-primary-hover font-medium"
        >
          Edit Cart
        </Link>
      </div>
      <ul className="divide-y divide-gray-100">
        {items.map((item) => (
          <li key={item.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-500">
                    {item.quantity}x
                  </span>
                  <span className="font-medium text-gray-900 truncate">
                    {item.name}
                  </span>
                </div>
                {item.selectedModifiers?.length > 0 && (
                  <p className="text-sm text-gray-500 mt-0.5 truncate">
                    {item.selectedModifiers.map((mod) => mod.modifierName).join(", ")}
                  </p>
                )}
                {item.specialInstructions && (
                  <p className="text-sm text-gray-400 mt-0.5 italic truncate">
                    {item.specialInstructions}
                  </p>
                )}
              </div>
              <span className="text-sm font-medium text-gray-900 flex-shrink-0">
                {formatPrice(item.totalPrice)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
