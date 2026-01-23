"use client";

import { useState, useTransition } from "react";
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardFormatPrice } from "@/hooks";
import {
  addFeaturedItemAction,
  removeFeaturedItemAction,
  reorderFeaturedItemsAction,
} from "@/app/(dashboard)/dashboard/(protected)/menu/actions";
import { MenuItemRow } from "./MenuItemRow";
import { MenuItemSearchList } from "./MenuItemSearchList";

interface FeaturedItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
}

interface AvailableItem extends FeaturedItem {
  categoryName: string;
}

interface FeaturedItemsClientProps {
  selectedItems: FeaturedItem[];
  availableItems: AvailableItem[];
}

function SortableItem({
  item,
  onRemove,
  isPending,
}: {
  item: FeaturedItem;
  onRemove: () => void;
  isPending: boolean;
}) {
  const formatPrice = useDashboardFormatPrice();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border bg-white p-3 ${
        isDragging ? "opacity-50 shadow-lg" : "shadow-sm"
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-gray-400 hover:text-gray-600"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {/* Image */}
      <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-gray-100">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-5 w-5 text-gray-300" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <h4 className="truncate font-medium text-gray-900">{item.name}</h4>
        <p className="text-sm text-gray-500">{formatPrice(item.price)}</p>
      </div>

      {/* Remove button */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onRemove}
        disabled={isPending}
        className="text-gray-400 hover:text-red-500"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function FeaturedItemsClient({
  selectedItems: initialSelected,
  availableItems: initialAvailable,
}: FeaturedItemsClientProps) {
  const [selectedItems, setSelectedItems] =
    useState<FeaturedItem[]>(initialSelected);
  const [availableItems, setAvailableItems] =
    useState<AvailableItem[]>(initialAvailable);
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = selectedItems.findIndex((item) => item.id === active.id);
      const newIndex = selectedItems.findIndex((item) => item.id === over.id);
      const newItems = arrayMove(selectedItems, oldIndex, newIndex);
      setSelectedItems(newItems);

      // Save new order
      startTransition(async () => {
        await reorderFeaturedItemsAction(newItems.map((item) => item.id));
      });
    }
  };

  const handleAdd = (item: AvailableItem) => {
    // Optimistic update
    setSelectedItems((prev) => [
      ...prev,
      {
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        imageUrl: item.imageUrl,
      },
    ]);
    setAvailableItems((prev) => prev.filter((i) => i.id !== item.id));

    // Save to server
    startTransition(async () => {
      const result = await addFeaturedItemAction(item.id);
      if (!result.success) {
        // Revert on error
        setSelectedItems((prev) => prev.filter((i) => i.id !== item.id));
        setAvailableItems((prev) => [...prev, item]);
      }
    });
  };

  const handleRemove = (item: FeaturedItem) => {
    // Find the full item info from available or use what we have
    const availableItem = initialAvailable.find((a) => a.id === item.id);

    // Optimistic update
    setSelectedItems((prev) => prev.filter((i) => i.id !== item.id));
    if (availableItem) {
      setAvailableItems((prev) => [...prev, availableItem]);
    }

    // Save to server
    startTransition(async () => {
      const result = await removeFeaturedItemAction(item.id);
      if (!result.success) {
        // Revert on error
        setSelectedItems((prev) => [...prev, item]);
        if (availableItem) {
          setAvailableItems((prev) => prev.filter((i) => i.id !== item.id));
        }
      }
    });
  };

  const formatPrice = useDashboardFormatPrice();

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Featured Items</h1>
        <p className="mt-1 text-sm text-gray-500">
          Select items to feature on your menu. These will appear in a
          &quot;Featured&quot; section at the top of your storefront menu.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Selected Items */}
        <div>
          <h2 className="mb-3 text-sm font-medium text-gray-700">
            Featured Items ({selectedItems.length})
          </h2>
          {selectedItems.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-500">
                No featured items yet. Add items from the list on the right.
              </p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={selectedItems.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {selectedItems.map((item) => (
                    <SortableItem
                      key={item.id}
                      item={item}
                      onRemove={() => handleRemove(item)}
                      isPending={isPending}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Available Items */}
        <div>
          <h2 className="mb-3 text-sm font-medium text-gray-700">
            Available Items ({availableItems.length})
          </h2>

          <MenuItemSearchList
            items={availableItems}
            filterFn={(item, query) =>
              item.name.toLowerCase().includes(query.toLowerCase()) ||
              item.categoryName.toLowerCase().includes(query.toLowerCase())
            }
            renderItem={(item) => (
              <MenuItemRow
                item={item}
                subtitle={`${item.categoryName} · ${formatPrice(item.price)}`}
                rightSlot={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleAdd(item)}
                    disabled={isPending}
                    className="text-gray-400 hover:text-green-600"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                }
                imageSize="sm"
                className="shadow-sm"
              />
            )}
            getItemKey={(item) => item.id}
            searchPlaceholder="Search items..."
            emptyMessage="All items have been added."
            emptySearchMessage="No items match your search."
          />
        </div>
      </div>
    </div>
  );
}
