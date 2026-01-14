"use client";

import type { MenuCategoryViewModel } from "@/types/menu-page";

interface MenuCategoryNavProps {
  categories: MenuCategoryViewModel[];
  activeCategory: string | null;
  onCategoryClick: (categoryId: string) => void;
}

export function MenuCategoryNav({
  categories,
  activeCategory,
  onCategoryClick,
}: MenuCategoryNavProps) {
  return (
    <nav className="sticky top-16 z-40 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-1 overflow-x-auto py-3 scrollbar-hide">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => onCategoryClick(category.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategory === category.id
                  ? "bg-red-600 text-white"
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
