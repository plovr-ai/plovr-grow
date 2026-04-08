"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { X, Search, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface MenuInfo {
  id: string;
  name: string;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  categoryName: string;
  menuId: string;
}

interface SelectedItemWithQuantity {
  item: MenuItem;
  quantity: number;
}

interface MenuItemPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (items: SelectedItemWithQuantity[]) => void;
  menus: MenuInfo[];
  menuItems: MenuItem[];
  formatPrice: (price: number) => string;
  mode?: "single" | "multi";
  selectedItemId?: string;
}

export function MenuItemPickerModal({
  isOpen,
  onClose,
  onSelect,
  menus,
  menuItems,
  formatPrice,
  mode = "multi",
  selectedItemId,
}: MenuItemPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(
    menus.length > 0 ? menus[0].id : null
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItemWithQuantity>>(
    new Map()
  );

  // Key for React rendering (unique per category-item combination)
  const getReactKey = (item: MenuItem) => `${item.categoryId}-${item.id}`;

  // Key for state Map (same item shares quantity across categories)
  const getStateKey = (item: MenuItem) => item.id;

  // Ensure selectedMenuId is valid (in case menus change)
  const effectiveMenuId = useMemo(() => {
    if (selectedMenuId && menus.some((m) => m.id === selectedMenuId)) {
      return selectedMenuId;
    }
    return menus.length > 0 ? menus[0].id : null;
  }, [selectedMenuId, menus]);

  // Filter items by selected menu first
  const menuFilteredItems = useMemo(() => {
    if (!effectiveMenuId) return menuItems;
    return menuItems.filter((item) => item.menuId === effectiveMenuId);
  }, [menuItems, effectiveMenuId]);

  // Extract unique categories from menu-filtered items
  const categories = useMemo(() => {
    const categorySet = new Set(menuFilteredItems.map((item) => item.categoryName));
    return Array.from(categorySet).sort();
  }, [menuFilteredItems]);

  // Auto-select first category when categories change or selectedCategory is invalid
  useEffect(() => {
    if (categories.length > 0 && (!selectedCategory || !categories.includes(selectedCategory))) {
      // Defer to avoid synchronous setState in effect
      queueMicrotask(() => setSelectedCategory(categories[0]));
    }
  }, [categories, selectedCategory]);

  // Filter items based on search and category
  // When searching, ignore category filter to search all items in current menu
  const filteredItems = useMemo(() => {
    return menuFilteredItems.filter((item) => {
      const matchesSearch = item.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      // If searching, ignore category filter
      if (searchQuery) {
        return matchesSearch;
      }
      return item.categoryName === selectedCategory;
    });
  }, [menuFilteredItems, searchQuery, selectedCategory]);

  // Reset state when modal closes
  const handleClose = useCallback(() => {
    setSearchQuery("");
    setSelectedCategory(null);
    setSelectedItems(new Map());
    onClose();
  }, [onClose]);

  // Reset category when menu changes
  const handleMenuChange = (menuId: string) => {
    setSelectedMenuId(menuId);
    setSelectedCategory(null);
  };

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const handleIncrement = (item: MenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedItems((prev) => {
      const next = new Map(prev);
      const key = getStateKey(item);
      const existing = next.get(key);
      if (existing) {
        next.set(key, { item, quantity: existing.quantity + 1 });
      } else {
        next.set(key, { item, quantity: 1 });
      }
      return next;
    });
  };

  const handleDecrement = (item: MenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedItems((prev) => {
      const next = new Map(prev);
      const key = getStateKey(item);
      const existing = next.get(key);
      if (existing) {
        if (existing.quantity <= 1) {
          next.delete(key);
        } else {
          next.set(key, { item, quantity: existing.quantity - 1 });
        }
      }
      return next;
    });
  };

  const handleItemClick = (item: MenuItem) => {
    if (mode === "single") {
      onSelect([{ item, quantity: 1 }]);
      handleClose();
    } else {
      // In multi mode, clicking the card increments by 1
      setSelectedItems((prev) => {
        const next = new Map(prev);
        const key = getStateKey(item);
        const existing = next.get(key);
        if (existing) {
          next.set(key, { item, quantity: existing.quantity + 1 });
        } else {
          next.set(key, { item, quantity: 1 });
        }
        return next;
      });
    }
  };

  const handleConfirm = () => {
    onSelect(Array.from(selectedItems.values()));
    handleClose();
  };

  // Calculate total quantity for footer display
  const totalQuantity = Array.from(selectedItems.values()).reduce(
    (sum, { quantity }) => sum + quantity,
    0
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="menu-item-picker-title"
    >
      <div
        className="flex h-[80vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2
            id="menu-item-picker-title"
            className="text-lg font-semibold text-gray-900"
          >
            Select Menu Item
          </h2>
          <Button variant="ghost" size="icon-sm" onClick={handleClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Menu Tabs */}
        {menus.length > 1 && (
          <div className="border-b px-6">
            <div className="flex gap-1">
              {menus.map((menu) => (
                <button
                  key={menu.id}
                  onClick={() => handleMenuChange(menu.id)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
                    effectiveMenuId === menu.id
                      ? "border-theme-primary text-theme-primary"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  )}
                >
                  {menu.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="border-b px-6 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Main Content: Categories + Items */}
        <div className="flex flex-1 overflow-hidden">
          {/* Category Sidebar */}
          <div className="w-48 flex-shrink-0 overflow-y-auto border-r bg-gray-50 p-4">
            <nav className="flex flex-col gap-1">
              {categories.map((category) => {
                const count = menuFilteredItems.filter(
                  (item) => item.categoryName === category
                ).length;
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      selectedCategory === category
                        ? "bg-theme-primary-light text-theme-primary-hover border-l-4 border-theme-primary"
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    {category}
                    <span className="ml-1 text-xs opacity-75">({count})</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Items Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-gray-500">
                  {searchQuery
                    ? "No items match your search"
                    : "No items available"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {filteredItems.map((item) => {
                  const selectedItem = selectedItems.get(getStateKey(item));
                  const quantity = selectedItem?.quantity ?? 0;
                  const isSelected =
                    mode === "single"
                      ? selectedItemId === item.id
                      : quantity > 0;
                  return (
                    <div
                      key={getReactKey(item)}
                      className={cn(
                        "relative flex flex-col rounded-lg border p-3 transition-colors",
                        isSelected
                          ? "border-theme-primary bg-theme-primary-light"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => handleItemClick(item)}
                        className="flex-1 text-left"
                      >
                        <span className="font-medium text-gray-900 line-clamp-2">
                          {item.name}
                        </span>
                        <span className="mt-1 block text-xs text-gray-500">
                          {item.categoryName}
                        </span>
                        <span className="mt-2 block font-semibold text-gray-900">
                          {formatPrice(item.price)}
                        </span>
                      </button>
                      {mode === "multi" && (
                        <div className="mt-3 flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => handleDecrement(item, e)}
                            disabled={quantity === 0}
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-full border transition-colors",
                              quantity > 0
                                ? "border-theme-primary text-theme-primary hover:bg-theme-primary hover:text-theme-primary-foreground"
                                : "border-gray-300 text-gray-300 cursor-not-allowed"
                            )}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span
                            className={cn(
                              "w-8 text-center font-medium",
                              quantity > 0 ? "text-gray-900" : "text-gray-400"
                            )}
                          >
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleIncrement(item, e)}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-theme-primary text-theme-primary transition-colors hover:bg-theme-primary hover:text-theme-primary-foreground"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer - Multi-select confirmation */}
        {mode === "multi" && (
          <div className="flex items-center justify-between border-t px-6 py-4">
            <span className="text-sm text-gray-600">
              {totalQuantity === 0
                ? "Select items to add"
                : `${selectedItems.size} item${selectedItems.size > 1 ? "s" : ""}, ${totalQuantity} total`}
            </span>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={totalQuantity === 0}
              >
                Add Items{totalQuantity > 0 ? ` (${totalQuantity})` : ""}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
