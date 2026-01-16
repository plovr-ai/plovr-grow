"use client";

import { useState, useMemo, useCallback, useRef, useLayoutEffect, useEffect } from "react";
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

  const isScrollingRef = useRef(false);

  const handleCategoryClick = useCallback((categoryId: string) => {
    setActiveCategory(categoryId);
    isScrollingRef.current = true;
    const element = document.getElementById(`category-${categoryId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 1000);
    }
  }, []);

  // Intersection Observer to update active category on scroll
  useEffect(() => {
    const categoryIds = data.categories.map((c) => c.category.id);
    const observers: IntersectionObserver[] = [];

    categoryIds.forEach((categoryId) => {
      const element = document.getElementById(`category-${categoryId}`);
      if (!element) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !isScrollingRef.current) {
              setActiveCategory(categoryId);
            }
          });
        },
        {
          rootMargin: "-20% 0px -70% 0px",
          threshold: 0,
        }
      );

      observer.observe(element);
      observers.push(observer);
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, [data.categories]);

  const handleAddItem = useCallback(
    (itemId: string) => {
      // Find the item in menu categories
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
        imageUrl: menuItem.imageUrl,
      });
    },
    [data.categories, addItem]
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28">
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
