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
}

export function MenuManagementClient({
  menus,
  currentMenuId,
  categories,
  taxConfigs,
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

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) || null;

  // Menu handlers
  const handleSelectMenu = (menuId: string) => {
    router.replace(`/dashboard/menu?menu=${menuId}`, { scroll: false });
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
    router.replace(`/dashboard/menu?menu=${currentMenuId}&category=${id}`, {
      scroll: false,
    });
  };

  // Menu item handlers - navigate to separate pages
  const handleAddItem = () => {
    if (selectedCategoryId) {
      router.push(`/dashboard/menu/items/new?menuId=${currentMenuId}&categoryId=${selectedCategoryId}`);
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

      {/* Main content */}
      <div className="mt-4 flex flex-1 gap-6 overflow-hidden">
        {/* Left sidebar - Categories */}
        <div className="w-64 shrink-0 overflow-y-auto">
          <Button
            onClick={handleAddCategory}
            variant="outline"
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
    </div>
  );
}
