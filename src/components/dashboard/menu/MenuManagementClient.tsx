"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MenuTabs } from "./MenuTabs";
import { MenuForm } from "./MenuForm";
import { CategoryList } from "./CategoryList";
import { CategoryForm } from "./CategoryForm";
import { MenuItemList } from "./MenuItemList";
import { AddExistingItemModal } from "./AddExistingItemModal";
import { updateMenuSortOrderAction } from "@/app/(dashboard)/dashboard/(protected)/menu/actions";
import type {
  MenuInfo,
  DashboardCategory,
  TaxConfigOption,
} from "@/services/menu/menu.types";

interface MenuManagementClientProps {
  menus: MenuInfo[];
  currentMenuId: string;
  categories: DashboardCategory[];
  taxConfigs: TaxConfigOption[];
  showArchived: boolean;
}

export function MenuManagementClient({
  menus,
  currentMenuId,
  categories,
  taxConfigs,
  showArchived,
}: MenuManagementClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Menu state
  const [isMenuFormOpen, setIsMenuFormOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<MenuInfo | null>(null);

  // Category state
  const categoryFromUrl = searchParams.get("category");
  const defaultCategoryId = categories.length > 0 ? categories[0].id : null;

  const selectedCategoryId =
    categoryFromUrl && categories.some((c) => c.id === categoryFromUrl)
      ? categoryFromUrl
      : defaultCategoryId;

  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<DashboardCategory | null>(null);
  const [isAddExistingItemOpen, setIsAddExistingItemOpen] = useState(false);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) || null;

  // Menu handlers
  const handleSelectMenu = (menuId: string) => {
    const params = new URLSearchParams();
    params.set("menu", menuId);
    if (showArchived) {
      params.set("archived", "true");
    }
    router.replace(`/dashboard/menu?${params.toString()}`, { scroll: false });
  };

  const handleAddMenu = () => {
    setEditingMenu(null);
    setIsMenuFormOpen(true);
  };

  const handleEditMenu = (menu: MenuInfo) => {
    setEditingMenu(menu);
    setIsMenuFormOpen(true);
  };

  const handleCloseMenuForm = () => {
    setIsMenuFormOpen(false);
    setEditingMenu(null);
  };

  const handleReorderMenus = (
    updates: Array<{ id: string; sortOrder: number }>
  ) => {
    startTransition(async () => {
      await updateMenuSortOrderAction(updates);
    });
  };

  // Archived tab handler
  const handleToggleArchived = (show: boolean) => {
    const params = new URLSearchParams();
    params.set("menu", currentMenuId);
    if (selectedCategoryId) {
      params.set("category", selectedCategoryId);
    }
    if (show) {
      params.set("archived", "true");
    }
    router.replace(`/dashboard/menu?${params.toString()}`, { scroll: false });
  };

  // Category handlers
  const handleAddCategory = () => {
    setEditingCategory(null);
    setIsCategoryFormOpen(true);
  };

  const handleEditCategory = (category: DashboardCategory) => {
    setEditingCategory(category);
    setIsCategoryFormOpen(true);
  };

  const handleCloseCategoryForm = () => {
    setIsCategoryFormOpen(false);
    setEditingCategory(null);
  };

  const handleSelectCategory = (id: string) => {
    const params = new URLSearchParams();
    params.set("menu", currentMenuId);
    params.set("category", id);
    if (showArchived) {
      params.set("archived", "true");
    }
    router.replace(`/dashboard/menu?${params.toString()}`, { scroll: false });
  };

  // Menu item handlers - navigate to separate pages
  const handleAddItem = () => {
    if (selectedCategoryId) {
      router.push(`/dashboard/menu/items/new?menuId=${currentMenuId}&categoryId=${selectedCategoryId}`);
    }
  };

  const handleAddExistingItem = () => {
    if (selectedCategoryId) {
      setIsAddExistingItemOpen(true);
    }
  };

  const handleEditItem = (itemId: string) => {
    router.push(`/dashboard/menu/items/${itemId}/edit?menuId=${currentMenuId}`);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="pb-4">
        <h2 className="text-2xl font-bold">Menu Management</h2>
        <p className="text-sm text-gray-500">
          Manage your menus, categories and items
        </p>
      </div>

      {/* Menu Tabs */}
      <MenuTabs
        menus={menus}
        selectedMenuId={currentMenuId}
        onSelectMenu={handleSelectMenu}
        onAddMenu={handleAddMenu}
        onEditMenu={handleEditMenu}
        onReorderMenus={handleReorderMenus}
      />

      {/* Archived Tab */}
      <div className="mt-4 flex items-center justify-between border-b pb-2">
        <div className="flex gap-2">
          <button
            onClick={() => handleToggleArchived(false)}
            className={`px-4 py-2 font-medium transition-colors ${
              !showArchived
                ? "border-b-2 border-theme-primary text-theme-primary-hover"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Menu Items
          </button>
          <button
            onClick={() => handleToggleArchived(true)}
            className={`px-4 py-2 font-medium transition-colors ${
              showArchived
                ? "border-b-2 border-theme-primary text-theme-primary-hover"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Archived
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="mt-4 flex flex-1 gap-6 overflow-hidden">
        {/* Left sidebar - Categories */}
        <div className="w-64 shrink-0 overflow-y-auto">
          <Button
            onClick={handleAddCategory}
            className="mb-3 w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>

          {categories.length > 0 ? (
            <CategoryList
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={handleSelectCategory}
              onEditCategory={handleEditCategory}
            />
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-gray-500">
              <p>No categories yet</p>
            </div>
          )}
        </div>

        {/* Right panel - Menu Items */}
        <div className="flex-1 overflow-y-auto">
          <MenuItemList
            category={selectedCategory}
            taxConfigs={taxConfigs}
            onAddItem={handleAddItem}
            onAddExistingItem={handleAddExistingItem}
            onEditItem={handleEditItem}
          />
        </div>
      </div>

      {/* Menu Form Modal */}
      {isMenuFormOpen && (
        <MenuForm
          menu={editingMenu}
          onClose={handleCloseMenuForm}
          canDelete={menus.length > 1}
        />
      )}

      {/* Category Form Modal */}
      {isCategoryFormOpen && (
        <CategoryForm
          menuId={currentMenuId}
          category={editingCategory}
          onClose={handleCloseCategoryForm}
        />
      )}

      {/* Add Existing Item Modal */}
      {isAddExistingItemOpen && selectedCategory && (
        <AddExistingItemModal
          categoryId={selectedCategory.id}
          categoryName={selectedCategory.name}
          onClose={() => setIsAddExistingItemOpen(false)}
        />
      )}
    </div>
  );
}
