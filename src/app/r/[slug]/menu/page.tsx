"use client";

import { useState, useMemo, useCallback, useRef, useLayoutEffect } from "react";
import { useParams } from "next/navigation";
import {
  MenuHeader,
  MenuCategoryNav,
  MenuCategorySection,
} from "@/components/menu";
import { getMockMenuPageData } from "@/data/mock/menu";
import { useCartStore } from "@/stores";
import type { MenuItemViewModel } from "@/types/menu-page";

export default function MenuPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const data = useMemo(() => getMockMenuPageData(slug), [slug]);

  const initialCategory = data.categories[0]?.category.id ?? null;
  const [activeCategory, setActiveCategory] = useState<string | null>(initialCategory);

  const setTenantId = useCartStore((state) => state.setTenantId);
  const addItem = useCartStore((state) => state.addItem);

  const tenantIdSetRef = useRef(false);
  useLayoutEffect(() => {
    if (!tenantIdSetRef.current) {
      tenantIdSetRef.current = true;
      setTenantId(slug);
    }
  }, [slug, setTenantId]);

  const handleCategoryClick = useCallback((categoryId: string) => {
    setActiveCategory(categoryId);
    const element = document.getElementById(`category-${categoryId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const handleAddItem = useCallback(
    (itemId: string) => {
      // Find the item in the menu data
      let menuItem: MenuItemViewModel | undefined;
      for (const category of data.categories) {
        menuItem = category.items.find((item) => item.id === itemId);
        if (menuItem) break;
      }

      if (!menuItem) return;

      addItem({
        menuItemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: 1,
        selectedOptions: [],
      });
    },
    [data, addItem]
  );

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
