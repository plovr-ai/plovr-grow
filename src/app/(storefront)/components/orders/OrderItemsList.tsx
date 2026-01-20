"use client";

import { useFormatPrice } from "@/hooks";
import type { OrderItemData } from "@/types";

interface Props {
  items: OrderItemData[];
  imageMap: Record<string, string | null>;
}

export function OrderItemsList({ items, imageMap }: Props) {
  const formatPrice = useFormatPrice();
  const itemCount = items.reduce((count, item) => count + item.quantity, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <h2 className="text-sm font-medium text-gray-700 mb-3">
        Order Items ({itemCount} {itemCount === 1 ? "item" : "items"})
      </h2>
      <ul className="divide-y divide-gray-100">
        {items.map((item, index) => {
          const imageUrl = imageMap[item.menuItemId];
          return (
          <li key={`${item.menuItemId}-${index}`} className="py-3 first:pt-0 last:pb-0">
            <div className="flex gap-3">
              {/* Item Image */}
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={item.name}
                  className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              )}

              {/* Item Details */}
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

              {/* Price */}
              <span className="text-sm font-medium text-gray-900 flex-shrink-0">
                {formatPrice(item.totalPrice)}
              </span>
            </div>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
