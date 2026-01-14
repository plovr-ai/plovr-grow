"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  MenuHeader,
  MenuCategoryNav,
  MenuCategorySection,
} from "@/components/menu";
import { getMockMenuPageData } from "@/data/mock/menu";
import type { MenuPageViewModel } from "@/types/menu-page";

export default function MenuPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [data, setData] = useState<MenuPageViewModel | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    const menuData = getMockMenuPageData(slug);
    setData(menuData);
    if (menuData.categories.length > 0) {
      setActiveCategory(menuData.categories[0].category.id);
    }
  }, [slug]);

  const handleCategoryClick = useCallback((categoryId: string) => {
    setActiveCategory(categoryId);
    const element = document.getElementById(`category-${categoryId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const handleAddItem = useCallback((itemId: string) => {
    console.log("Add item:", itemId);
    // TODO: Open item detail modal or add to cart
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
      </div>
    );
  }

  const categoryViewModels = data.categories.map((c) => c.category);

  return (
    <>
      <MenuHeader
        merchantName={data.merchantName}
        merchantLogo={data.merchantLogo}
        tenantSlug={slug}
      />

      <MenuCategoryNav
        categories={categoryViewModels}
        activeCategory={activeCategory}
        onCategoryClick={handleCategoryClick}
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="space-y-10">
          {data.categories.map((categoryData) => (
            <MenuCategorySection
              key={categoryData.category.id}
              data={categoryData}
              onAddItem={handleAddItem}
            />
          ))}
        </div>
      </main>
    </>
  );
}
