"use client";

import { useCallback, useRef } from "react";
import type { MenuItemViewModel, MenuItemTag } from "@/types/menu-page";
import { useFormatPrice } from "@/hooks";
import { ImagePlaceholderIcon } from "@storefront/components/icons";
import type { AnimationPosition } from "@storefront/lib/cartAnimation";

export interface AddClickParams {
  itemId: string;
  startPosition: AnimationPosition;
  imageUrl: string | null;
}

interface MenuItemCardProps {
  item: MenuItemViewModel;
  onAddClick: (params: AddClickParams) => void;
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
  const imageRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleAddClick = useCallback(() => {
    // Get start position (from image or button)
    const sourceEl = imageRef.current || buttonRef.current;
    if (!sourceEl) return;

    const sourceRect = sourceEl.getBoundingClientRect();
    const startPosition: AnimationPosition = {
      x: sourceRect.left + sourceRect.width / 2 - 20,
      y: sourceRect.top + sourceRect.height / 2 - 20,
    };

    // Pass position info to parent - parent decides when to animate
    onAddClick({
      itemId: item.id,
      startPosition,
      imageUrl: item.imageUrl,
    });
  }, [item.id, item.imageUrl, onAddClick]);

  return (
    <div className="flex gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all">
      {item.imageUrl ? (
        <div
          ref={imageRef}
          className="flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden"
        >
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div
          ref={imageRef}
          className="flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-lg bg-gray-100 flex items-center justify-center"
        >
          <ImagePlaceholderIcon className="w-8 h-8 text-gray-300" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
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
          <span className="text-lg font-semibold text-gray-900 whitespace-nowrap">
            {formatPrice(item.price)}
          </span>
        </div>

        {item.description && (
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
            {item.description}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between">
          {item.hasModifiers && (
            <span className="text-xs text-gray-400">Customizable</span>
          )}
          <button
            ref={buttonRef}
            onClick={handleAddClick}
            disabled={!item.isAvailable}
            className={`ml-auto px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ${
              item.isAvailable
                ? "bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-foreground active:scale-90"
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
