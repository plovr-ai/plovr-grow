"use client";

import { useState, useTransition, useEffect } from "react";
import { X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getAvailableItemsAction,
  linkItemToCategoryAction,
} from "@/app/(dashboard)/dashboard/(protected)/menu/actions";
import { getApiErrorMessage } from "@/lib/api";
import type { AvailableItem } from "@/services/menu/menu.types";
import { MenuItemRow } from "./MenuItemRow";
import { MenuItemSearchList } from "./MenuItemSearchList";

interface AddExistingItemModalProps {
  categoryId: string;
  categoryName: string;
  onClose: () => void;
}

export function AddExistingItemModal({
  categoryId,
  categoryName,
  onClose,
}: AddExistingItemModalProps) {
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<AvailableItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Load available items
  useEffect(() => {
    async function loadItems() {
      setIsLoading(true);
      const result = await getAvailableItemsAction(categoryId);
      if (result.success && result.data) {
        setItems(result.data);
      } else {
        setError(getApiErrorMessage(result.error, "Failed to load items"));
      }
      setIsLoading(false);
    }
    loadItems();
  }, [categoryId]);

  const toggleSelection = (itemId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedIds(newSelected);
  };

  const handleAdd = () => {
    if (selectedIds.size === 0) return;

    startTransition(async () => {
      // Add each selected item to the category
      for (const itemId of selectedIds) {
        const result = await linkItemToCategoryAction(categoryId, itemId);
        if (!result.success) {
          setError(getApiErrorMessage(result.error, "Failed to add item"));
          return;
        }
      }
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Add Existing Items</h2>
            <p className="text-sm text-gray-500">
              Add items to &quot;{categoryName}&quot;
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Items list with search */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <MenuItemSearchList
            items={items}
            isLoading={isLoading}
            filterFn={(item, query) =>
              item.name.toLowerCase().includes(query.toLowerCase()) ||
              (item.description?.toLowerCase().includes(query.toLowerCase()) ?? false)
            }
            renderItem={(item) => (
              <MenuItemRow
                item={item}
                subtitle={item.description}
                metadata={
                  item.categoryNames.length > 0 && (
                    <p className="mt-1 text-xs text-gray-400">
                      In: {item.categoryNames.join(", ")}
                    </p>
                  )
                }
                leftSlot={
                  <div
                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${
                      selectedIds.has(item.id)
                        ? "border-theme-primary bg-theme-primary text-white"
                        : "border-gray-300"
                    }`}
                  >
                    {selectedIds.has(item.id) && <Check className="h-3 w-3" />}
                  </div>
                }
                onClick={() => toggleSelection(item.id)}
                isHighlighted={selectedIds.has(item.id)}
                imageSize="md"
              />
            )}
            getItemKey={(item) => item.id}
            searchPlaceholder="Search items..."
            emptyMessage="No items available to add - All items are already in this category"
            emptySearchMessage="No items match your search - Try a different search term"
            maxHeight="max-h-[60vh]"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-6 py-4">
          <p className="text-sm text-gray-500">
            {selectedIds.size} item{selectedIds.size !== 1 ? "s" : ""} selected
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={isPending || selectedIds.size === 0}
            >
              {isPending ? "Adding..." : `Add ${selectedIds.size > 0 ? selectedIds.size : ""} Item${selectedIds.size !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
