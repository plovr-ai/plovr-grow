"use client";

import { useFormatPrice } from "@/hooks";
import type { OrderItemData } from "@/types";

interface Props {
  items: OrderItemData[];
}

export function OrderItemsList({ items }: Props) {
  const formatPrice = useFormatPrice();
  const itemCount = items.reduce((count, item) => count + item.quantity, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <h2 className="text-sm font-medium text-gray-700 mb-3">
        Order Items ({itemCount} {itemCount === 1 ? "item" : "items"})
      </h2>
      <ul className="divide-y divide-gray-100">
        {items.map((item, index) => (
          <li key={`${item.menuItemId}-${index}`} className="py-3 first:pt-0 last:pb-0">
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
                {item.selectedModifiers && item.selectedModifiers.length > 0 && (
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
