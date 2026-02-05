"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { X, Search } from "lucide-react";
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
  categoryName: string;
  menuId: string;
}

interface MenuItemPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: MenuItem) => void;
  menus: MenuInfo[];
  menuItems: MenuItem[];
  formatPrice: (price: number) => string;
  selectedItemId?: string;
}

export function MenuItemPickerModal({
  isOpen,
  onClose,
  onSelect,
  menus,
  menuItems,
  formatPrice,
  selectedItemId,
}: MenuItemPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(
    menus.length > 0 ? menus[0].id : null
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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
      const matchesCategory =
        !selectedCategory || item.categoryName === selectedCategory;
      return matchesCategory;
    });
  }, [menuFilteredItems, searchQuery, selectedCategory]);

  // Reset state when modal closes
  const handleClose = useCallback(() => {
    setSearchQuery("");
    setSelectedCategory(null);
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

  const handleItemClick = (item: MenuItem) => {
    onSelect(item);
    handleClose();
  };

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
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  !selectedCategory
                    ? "bg-theme-primary-light text-theme-primary-hover border-l-4 border-theme-primary"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                All Items
                <span className="ml-1 text-xs opacity-75">
                  ({menuFilteredItems.length})
                </span>
              </button>
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
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={cn(
                      "flex flex-col items-start rounded-lg border p-3 text-left transition-colors",
                      selectedItemId === item.id
                        ? "border-theme-primary bg-theme-primary-light"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                    )}
                  >
                    <span className="font-medium text-gray-900 line-clamp-2">
                      {item.name}
                    </span>
                    <span className="mt-1 text-xs text-gray-500">
                      {item.categoryName}
                    </span>
                    <span className="mt-2 font-semibold text-gray-900">
                      {formatPrice(item.price)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
