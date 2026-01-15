"use client";

import type { MenuItemViewModel, MenuItemTag } from "@/types/menu-page";
import { useFormatPrice } from "@/hooks";

interface MenuItemCardProps {
  item: MenuItemViewModel;
  onAddClick: (itemId: string) => void;
}

const tagConfig: Record<MenuItemTag, { label: string; className: string }> = {
  vegetarian: { label: "V", className: "bg-green-100 text-green-700" },
  vegan: { label: "VG", className: "bg-green-100 text-green-700" },
  "gluten-free": { label: "GF", className: "bg-yellow-100 text-yellow-700" },
  spicy: { label: "Spicy", className: "bg-red-100 text-red-700" },
  popular: { label: "Popular", className: "bg-orange-100 text-orange-700" },
  new: { label: "New", className: "bg-blue-100 text-blue-700" },
};

export function MenuItemCard({ item, onAddClick }: MenuItemCardProps) {
  const formatPrice = useFormatPrice();
  return (
    <div className="flex gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all">
      {item.imageUrl ? (
        <div className="flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden">
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-lg bg-gray-100 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-gray-300"
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

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-gray-900">{item.name}</h3>
            {item.tags.length > 0 && (
              <div className="flex gap-1 mt-1">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`text-xs px-1.5 py-0.5 rounded ${tagConfig[tag].className}`}
                  >
                    {tagConfig[tag].label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <span className="font-semibold text-gray-900 whitespace-nowrap">
            {formatPrice(item.price)}
          </span>
        </div>

        {item.description && (
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
            {item.description}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between">
          {item.hasOptions && (
            <span className="text-xs text-gray-400">Customizable</span>
          )}
          <button
            onClick={() => onAddClick(item.id)}
            disabled={!item.isAvailable}
            className={`ml-auto px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              item.isAvailable
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            {item.isAvailable ? "Add" : "Unavailable"}
          </button>
        </div>
      </div>
    </div>
  );
}
