"use client";

import {
  useState,
  useCallback,
  useRef,
  useLayoutEffect,
  useEffect,
} from "react";
import {
  MenuHeader,
  MenuCategoryNav,
  MenuCategorySection,
  ModifierModal,
} from "@/components/menu";
import { useCartStore } from "@/stores";
import type { MenuDisplayData } from "@/app/r/[slug]/menu/utils";
import type { MenuItemViewModel } from "@/types/menu-page";
import type { SelectedModifier } from "@/types";

interface MenuPageClientProps {
  data: MenuDisplayData;
  tenantSlug: string;
}

export function MenuPageClient({ data, tenantSlug }: MenuPageClientProps) {
  const initialCategory = data.categories[0]?.category.id ?? null;
  const [activeCategory, setActiveCategory] = useState<string | null>(
    initialCategory
  );

  // Modal state
  const [modalItem, setModalItem] = useState<MenuItemViewModel | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const setTenantId = useCartStore((state) => state.setTenantId);
  const addItem = useCartStore((state) => state.addItem);

  const tenantIdSetRef = useRef(false);
  useLayoutEffect(() => {
    if (!tenantIdSetRef.current) {
      tenantIdSetRef.current = true;
      setTenantId(tenantSlug);
    }
  }, [tenantSlug, setTenantId]);

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

      // Check if item has modifiers
      if (menuItem.hasModifiers && menuItem.modifierGroups.length > 0) {
        // Open modal for items with modifiers
        setModalItem(menuItem);
        setIsModalOpen(true);
      } else {
        // Add directly to cart for items without modifiers
        addItem({
          menuItemId: menuItem.id,
          name: menuItem.name,
          price: menuItem.price,
          quantity: 1,
          selectedModifiers: [],
          imageUrl: menuItem.imageUrl,
          taxConfigId: menuItem.taxConfigId,
        });
      }
    },
    [data.categories, addItem]
  );

  // Handle modal confirmation
  const handleModalConfirm = useCallback(
    (selectedModifiers: SelectedModifier[], quantity: number) => {
      if (!modalItem) return;

      addItem({
        menuItemId: modalItem.id,
        name: modalItem.name,
        price: modalItem.price,
        quantity,
        selectedModifiers,
        imageUrl: modalItem.imageUrl,
        taxConfigId: modalItem.taxConfigId,
      });
    },
    [modalItem, addItem]
  );

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setModalItem(null);
  }, []);

  const categoryViewModels = data.categories.map((c) => c.category);

  return (
    <>
      <MenuHeader
        merchantName={data.merchantName}
        merchantLogo={data.merchantLogo}
        tenantSlug={tenantSlug}
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

      {/* Modifier Modal */}
      {modalItem && (
        <ModifierModal
          item={modalItem}
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onConfirm={handleModalConfirm}
        />
      )}
    </>
  );
}
