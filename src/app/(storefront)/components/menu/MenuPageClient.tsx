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
} from "@storefront/components/menu";
import { useCartStore } from "@/stores";
import type { MenuDisplayData } from "@storefront/r/[merchantSlug]/menu/utils";
import type { MenuItemViewModel } from "@/types/menu-page";
import type { SelectedModifier } from "@/types";
import type { AddClickParams } from "./MenuItemCard";
import { animateFlyToCart, type FlyToCartParams } from "@storefront/lib/cartAnimation";

interface MenuPageClientProps {
  data: MenuDisplayData;
  /** @deprecated Use merchantSlug instead */
  tenantSlug?: string;
  merchantSlug?: string;
}

export function MenuPageClient({
  data,
  tenantSlug,
  merchantSlug,
}: MenuPageClientProps) {
  // Support both old (tenantSlug) and new (merchantSlug) props
  const slug = merchantSlug ?? tenantSlug ?? "";
  const initialCategory = data.categories[0]?.category.id ?? null;
  const [activeCategory, setActiveCategory] = useState<string | null>(
    initialCategory
  );

  // Modal state
  const [modalItem, setModalItem] = useState<MenuItemViewModel | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Store animation params for modal items - triggered when modal confirms
  const pendingAnimationRef = useRef<FlyToCartParams | null>(null);

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
    ({ itemId, startPosition, imageUrl }: AddClickParams) => {
      // Find the item in menu categories
      let menuItem: MenuItemViewModel | undefined;
      for (const category of data.categories) {
        menuItem = category.items.find((item) => item.id === itemId);
        if (menuItem) break;
      }

      if (!menuItem) return;

      const animationParams: FlyToCartParams = { startPosition, imageUrl };

      // Check if item has modifiers
      if (menuItem.hasModifiers && menuItem.modifierGroups.length > 0) {
        // Store animation params for later - will be triggered when modal confirms
        pendingAnimationRef.current = animationParams;
        // Open modal for items with modifiers
        setModalItem(menuItem);
        setIsModalOpen(true);
      } else {
        // Trigger animation immediately for items without modifiers
        animateFlyToCart(animationParams);
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

      // Trigger pending animation when modal confirms
      if (pendingAnimationRef.current) {
        animateFlyToCart(pendingAnimationRef.current);
        pendingAnimationRef.current = null;
      }

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
    // Clear pending animation if modal is closed without confirming
    pendingAnimationRef.current = null;
  }, []);

  const categoryViewModels = data.categories.map((c) => c.category);

  return (
    <>
      <MenuHeader
        merchantName={data.merchantName}
        merchantLogo={data.merchantLogo}
        merchantSlug={slug}
        companySlug={data.companySlug}
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
