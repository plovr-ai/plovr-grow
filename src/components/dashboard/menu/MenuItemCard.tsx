"use client";

import { useState, useTransition } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, ImageIcon, FolderTree, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useDashboardFormatPrice } from "@/hooks";
import {
  deleteMenuItemAction,
  updateMenuItemAction,
} from "@/app/(dashboard)/dashboard/(protected)/menu/actions";
import type { DashboardMenuItem, TaxConfigOption } from "@/services/menu/menu.types";

// Custom three-button dialog for delete action
interface ActionChoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRemove: () => void;
  onArchive: () => void;
  isMultiCategory: boolean;
  categoryCount: number;
}

function ActionChoiceDialog({
  isOpen,
  onClose,
  onRemove,
  onArchive,
  isMultiCategory,
  categoryCount,
}: ActionChoiceDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Remove or Archive Item?
          </h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <p className="text-sm text-gray-600">
            {isMultiCategory
              ? `This item is in ${categoryCount} categories.`
              : "This item is only in this category."}
          </p>
          <p className="mt-2 text-sm text-gray-600">
            What would you like to do?
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="outline" onClick={onRemove}>
            Remove from Category
          </Button>
          <Button variant="destructive" onClick={onArchive}>
            Archive Item
          </Button>
        </div>
      </div>
    </div>
  );
}

interface MenuItemCardProps {
  item: DashboardMenuItem;
  taxConfigs: TaxConfigOption[];
  categoryId: string;
  onEdit: () => void;
}

export function MenuItemCard({ item, taxConfigs, categoryId, onEdit }: MenuItemCardProps) {
  const [isPending, startTransition] = useTransition();
  const formatPrice = useDashboardFormatPrice();
  const isInMultipleCategories = item.categoryIds.length > 1;
  const [showActionDialog, setShowActionDialog] = useState(false);

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

  const handleDelete = () => {
    setShowActionDialog(true);
  };

  const handleRemoveFromCategory = () => {
    setShowActionDialog(false);
    startTransition(async () => {
      await deleteMenuItemAction(item.id, { categoryId });
    });
  };

  const handleArchiveItem = () => {
    setShowActionDialog(false);
    startTransition(async () => {
      await deleteMenuItemAction(item.id);
    });
  };

  const handleStatusChange = (
    newStatus: "active" | "out_of_stock" | "archived"
  ) => {
    startTransition(async () => {
      await updateMenuItemAction(item.id, { status: newStatus });
    });
  };

  const getStatusBadge = () => {
    switch (item.status) {
      case "active":
        return (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            Active
          </span>
        );
      case "out_of_stock":
        return (
          <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
            Out of Stock
          </span>
        );
      case "archived":
        return (
          <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
            Archived
          </span>
        );
    }
  };

  // Get associated tax names
  const taxNames = item.taxConfigIds
    .map((id) => taxConfigs.find((tc) => tc.id === id)?.name)
    .filter(Boolean);

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onEdit}
      className={`group relative cursor-pointer overflow-hidden rounded-lg border bg-white shadow-sm transition-shadow hover:shadow-md ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      {/* Drag handle - positioned absolute */}
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="absolute left-2 top-2 z-10 cursor-grab rounded bg-white/80 p-1 text-gray-400 opacity-0 shadow-sm transition-opacity hover:text-gray-600 group-hover:opacity-100"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Image */}
      <div className="relative aspect-[4/3] bg-gray-100">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-12 w-12 text-gray-300" />
          </div>
        )}
        {/* Status and multi-category badges overlay */}
        <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
          {getStatusBadge()}
          {isInMultipleCategories && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              <FolderTree className="h-3 w-3" />
              {item.categoryIds.length}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        <h4 className="font-medium text-gray-900">{item.name}</h4>
        <p className="mt-1 h-8 line-clamp-2 text-xs text-gray-500">
          {item.description || "\u00A0"}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span className="font-semibold text-gray-900">
            {formatPrice(item.price)}
          </span>
          {item.modifierGroups.length > 0 && (
            <span className="text-xs text-gray-500">
              {item.modifierGroups.length} modifier
              {item.modifierGroups.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {taxNames.length > 0 && (
          <p className="mt-1 text-xs text-gray-400">
            Tax: {taxNames.join(", ")}
          </p>
        )}
      </div>

      {/* Actions */}
      <div
        className="flex items-center justify-between border-t px-3 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Status dropdown */}
        <Select
          value={item.status}
          onChange={(e) =>
            handleStatusChange(
              e.target.value as "active" | "out_of_stock" | "archived"
            )
          }
          disabled={isPending}
          className="h-8 w-auto text-xs"
        >
          <option value="active">Active</option>
          <option value="out_of_stock">Out of Stock</option>
          <option value="archived">Archived</option>
        </Select>

        {/* Delete button */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleDelete}
          disabled={isPending}
          className="text-red-500 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ActionChoiceDialog
        isOpen={showActionDialog}
        onClose={() => setShowActionDialog(false)}
        onRemove={handleRemoveFromCategory}
        onArchive={handleArchiveItem}
        isMultiCategory={isInMultipleCategories}
        categoryCount={item.categoryIds.length}
      />
    </div>
  );
}
