"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryList } from "./CategoryList";
import { CategoryForm } from "./CategoryForm";
import { MenuItemList } from "./MenuItemList";
import type {
  DashboardCategory,
  TaxConfigOption,
} from "@/services/menu/menu.types";

interface MenuManagementClientProps {
  categories: DashboardCategory[];
  taxConfigs: TaxConfigOption[];
}

export function MenuManagementClient({
  categories,
  taxConfigs,
}: MenuManagementClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL is the single source of truth for selected category
  const categoryFromUrl = searchParams.get("category");
  const defaultCategoryId = categories.length > 0 ? categories[0].id : null;

  // Derive selected category from URL, fallback to first category
  const selectedCategoryId = categoryFromUrl && categories.some((c) => c.id === categoryFromUrl)
    ? categoryFromUrl
    : defaultCategoryId;

  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<DashboardCategory | null>(null);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) || null;

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
    router.replace(`/dashboard/menu?category=${id}`, { scroll: false });
  };

  // Menu item handlers - navigate to separate pages
  const handleAddItem = () => {
    if (selectedCategoryId) {
      router.push(`/dashboard/menu/items/new?categoryId=${selectedCategoryId}`);
    }
  };

  const handleEditItem = (itemId: string) => {
    router.push(`/dashboard/menu/items/${itemId}/edit`);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold">Menu Management</h2>
          <p className="text-sm text-gray-500">
            Manage your menu categories and items
          </p>
        </div>
        <Button onClick={handleAddCategory}>
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </div>

      {/* Main content */}
      <div className="mt-4 flex flex-1 gap-6 overflow-hidden">
        {/* Left sidebar - Categories */}
        <div className="w-64 shrink-0 overflow-y-auto">
          <CategoryList
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={handleSelectCategory}
            onEditCategory={handleEditCategory}
          />
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

      {/* Category Form Modal */}
      {isCategoryFormOpen && (
        <CategoryForm
          category={editingCategory}
          onClose={handleCloseCategoryForm}
        />
      )}
    </div>
  );
}
