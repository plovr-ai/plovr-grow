"use client";

import { useEffect, useRef } from "react";
import type { MenuCategoryViewModel } from "@/types/menu-page";

interface MenuCategoryNavProps {
  categories: MenuCategoryViewModel[];
  activeCategory: string | null;
  onCategoryClick: (categoryId: string) => void;
  layout?: "horizontal" | "vertical";
}

export function MenuCategoryNav({
  categories,
  activeCategory,
  onCategoryClick,
  layout = "horizontal",
}: MenuCategoryNavProps) {
  const navRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Auto-scroll nav to show active category button
  useEffect(() => {
    if (!activeCategory || !navRef.current) return;

    const button = buttonRefs.current.get(activeCategory);
    if (!button) return;

    const nav = navRef.current;
    const buttonRect = button.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();

    if (layout === "horizontal") {
      // Horizontal: check left/right overflow
      if (buttonRect.left < navRect.left || buttonRect.right > navRect.right) {
        button.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    } else {
      // Vertical: check top/bottom overflow
      if (buttonRect.top < navRect.top || buttonRect.bottom > navRect.bottom) {
        button.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      }
    }
  }, [activeCategory, layout]);

  // Horizontal layout (mobile)
  if (layout === "horizontal") {
    return (
      <nav className="sticky top-16 z-40 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            ref={navRef}
            className="flex gap-1 overflow-x-auto py-3 scrollbar-hide"
          >
            {categories.map((category) => (
              <button
                key={category.id}
                ref={(el) => {
                  if (el) buttonRefs.current.set(category.id, el);
                }}
                onClick={() => onCategoryClick(category.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === category.id
                    ? "bg-theme-primary text-theme-primary-foreground"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {category.name}
                <span className="ml-1.5 text-xs opacity-75">
                  ({category.itemCount})
                </span>
              </button>
            ))}
          </div>
        </div>
      </nav>
    );
  }

  // Vertical layout (desktop sidebar)
  return (
    <nav
      ref={navRef}
      className="flex flex-col gap-1 max-h-[calc(100vh-160px)] overflow-y-auto scrollbar-hide"
    >
      {categories.map((category) => (
        <button
          key={category.id}
          ref={(el) => {
            if (el) buttonRefs.current.set(category.id, el);
          }}
          onClick={() => onCategoryClick(category.id)}
          className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeCategory === category.id
              ? "bg-theme-primary-light text-theme-primary-hover border-l-4 border-theme-primary"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          <span className="block truncate">{category.name}</span>
          <span className="text-xs opacity-75">
            {category.itemCount} items
          </span>
        </button>
      ))}
    </nav>
  );
}
