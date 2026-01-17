"use client";

import { useCallback, useRef } from "react";
import type { MenuItemViewModel, MenuItemTag } from "@/types/menu-page";
import { useFormatPrice } from "@/hooks";
import { ImagePlaceholderIcon } from "@/components/icons";

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

function animateFlyToCart(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  imageUrl: string | null
): void {
  const el = document.createElement("div");
  el.style.cssText = `
    position: fixed;
    left: 0;
    top: 0;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    z-index: 9999;
    pointer-events: none;
    background: ${imageUrl ? `url(${imageUrl}) center/cover` : "#ef4444"};
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    will-change: transform, opacity;
  `;
  document.body.appendChild(el);

  const duration = 500;
  const startTime = performance.now();

  // Parabola parameters
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const peakHeight = Math.min(150, Math.abs(deltaY) * 0.4 + 50);

  function easeOutQuad(t: number): number {
    return 1 - (1 - t) * (1 - t);
  }

  function animate(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // X moves linearly (or with slight ease)
    const easedProgress = easeOutQuad(progress);
    const x = startX + deltaX * easedProgress;

    // Y follows parabola: starts up, then curves down
    // Using quadratic bezier-like path
    const t = easedProgress;
    const y = startY + deltaY * t + peakHeight * 4 * t * (t - 1);

    // Scale shrinks from 1 to 0.3
    const scale = 1 - 0.7 * easedProgress;

    // Opacity stays 1 until near end
    const opacity = progress > 0.8 ? 1 - (progress - 0.8) * 2.5 : 1;

    el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    el.style.opacity = String(opacity);

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      el.remove();
    }
  }

  requestAnimationFrame(animate);
}

export function MenuItemCard({ item, onAddClick }: MenuItemCardProps) {
  const formatPrice = useFormatPrice();
  const imageRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleAddClick = useCallback(() => {
    onAddClick(item.id);

    // Get start position (from image or button)
    const sourceEl = imageRef.current || buttonRef.current;
    if (!sourceEl) return;

    const sourceRect = sourceEl.getBoundingClientRect();
    const startX = sourceRect.left + sourceRect.width / 2 - 20;
    const startY = sourceRect.top + sourceRect.height / 2 - 20;

    // Get end position (cart icon)
    const cartIcon = document.getElementById("cart-icon-target");
    let endX: number, endY: number;

    if (cartIcon) {
      const cartRect = cartIcon.getBoundingClientRect();
      endX = cartRect.left + cartRect.width / 2 - 20;
      endY = cartRect.top + cartRect.height / 2 - 20;
    } else {
      // Fallback: fly to bottom center of screen
      endX = window.innerWidth / 2 - 20;
      endY = window.innerHeight - 60;
    }

    // Animate flying element to cart
    animateFlyToCart(startX, startY, endX, endY, item.imageUrl);
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
          {item.hasModifiers && (
            <span className="text-xs text-gray-400">Customizable</span>
          )}
          <button
            ref={buttonRef}
            onClick={handleAddClick}
            disabled={!item.isAvailable}
            className={`ml-auto px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ${
              item.isAvailable
                ? "bg-red-600 hover:bg-red-700 text-white active:scale-90"
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
