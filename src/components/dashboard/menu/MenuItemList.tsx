"use client";

import { useTransition } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MenuItemCard } from "./MenuItemCard";
import { updateMenuItemSortOrderAction } from "@/app/(dashboard)/dashboard/(protected)/menu/actions";
import type { DashboardCategory, TaxConfigOption } from "@/services/menu/menu.types";

interface MenuItemListProps {
  category: DashboardCategory | null;
  taxConfigs: TaxConfigOption[];
  onAddItem: () => void;
  onEditItem: (itemId: string) => void;
}

export function MenuItemList({
  category,
  taxConfigs,
  onAddItem,
  onEditItem,
}: MenuItemListProps) {
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (!category) return;

    const { active, over } = event;

    if (over && active.id !== over.id) {
      const items = category.menuItems;
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newOrder = arrayMove(items, oldIndex, newIndex);

      // Build sort order updates
      const updates = newOrder.map((item, index) => ({
        id: item.id,
        sortOrder: index,
      }));

      startTransition(async () => {
        await updateMenuItemSortOrderAction(updates);
      });
    }
  };

  // No category selected
  if (!category) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 p-12">
        <FolderOpen className="h-12 w-12 text-gray-300" />
        <p className="mt-4 text-sm text-gray-500">Select a category to view items</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{category.name}</h3>
          <p className="text-sm text-gray-500">
            {category.menuItems.length} item
            {category.menuItems.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={onAddItem}>
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </div>

      {/* Items grid */}
      {category.menuItems.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 p-12">
          <p className="text-sm text-gray-500">No items in this category</p>
          <p className="mt-1 text-xs text-gray-400">
            Click &quot;Add Item&quot; to add your first menu item
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={category.menuItems.map((item) => item.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {category.menuItems.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  taxConfigs={taxConfigs}
                  onEdit={() => onEditItem(item.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
