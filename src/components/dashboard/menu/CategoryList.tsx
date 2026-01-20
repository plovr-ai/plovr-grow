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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  deleteCategoryAction,
  updateCategorySortOrderAction,
} from "@/app/(dashboard)/dashboard/(protected)/menu/actions";
import type { DashboardCategory } from "@/services/menu/menu.types";

interface CategoryListProps {
  categories: DashboardCategory[];
  selectedCategoryId: string | null;
  onSelectCategory: (id: string) => void;
  onEditCategory: (category: DashboardCategory) => void;
}

interface SortableCategoryItemProps {
  category: DashboardCategory;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

function SortableCategoryItem({
  category,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  isDeleting,
}: SortableCategoryItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const activeCount = category.menuItems.filter(
    (item) => item.status === "active"
  ).length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 rounded-lg border p-3 ${
        isSelected
          ? "border-theme-primary bg-theme-primary-light"
          : "border-gray-200 bg-white hover:border-gray-300"
      } ${isDragging ? "opacity-50" : ""} ${
        category.status === "inactive" ? "opacity-60" : ""
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-gray-400 hover:text-gray-600"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Category info - clickable */}
      <button
        onClick={onSelect}
        className="flex flex-1 flex-col items-start text-left"
      >
        <span
          className={`font-medium ${
            isSelected ? "text-theme-primary-hover" : "text-gray-900"
          }`}
        >
          {category.name}
        </span>
        <span className="text-xs text-gray-500">
          {activeCount} item{activeCount !== 1 ? "s" : ""}
          {category.status === "inactive" && " (Hidden)"}
        </span>
      </button>

      {/* Actions */}
      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={isDeleting}
          className="text-red-500 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function CategoryList({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onEditCategory,
}: CategoryListProps) {
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
      const oldIndex = categories.findIndex((c) => c.id === active.id);
      const newIndex = categories.findIndex((c) => c.id === over.id);

      const newOrder = arrayMove(categories, oldIndex, newIndex);

      // Build sort order updates
      const updates = newOrder.map((category, index) => ({
        id: category.id,
        sortOrder: index,
      }));

      startTransition(async () => {
        await updateCategorySortOrderAction(updates);
      });
    }
  };

  const handleDelete = (categoryId: string) => {
    if (!confirm("Are you sure you want to delete this category?")) {
      return;
    }

    startTransition(async () => {
      await deleteCategoryAction(categoryId);
    });
  };

  if (categories.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
        <p className="text-sm text-gray-500">No categories yet</p>
        <p className="mt-1 text-xs text-gray-400">
          Click &quot;Add Category&quot; to create your first category
        </p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={categories.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {categories.map((category) => (
            <SortableCategoryItem
              key={category.id}
              category={category}
              isSelected={category.id === selectedCategoryId}
              onSelect={() => onSelectCategory(category.id)}
              onEdit={() => onEditCategory(category)}
              onDelete={() => handleDelete(category.id)}
              isDeleting={isPending}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
