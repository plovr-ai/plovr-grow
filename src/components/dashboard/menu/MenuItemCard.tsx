"use client";

import { useState, useTransition } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, ImageIcon, FolderTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDashboardFormatPrice } from "@/hooks";
import {
  deleteMenuItemAction,
  updateMenuItemAction,
} from "@/app/(dashboard)/dashboard/(protected)/menu/actions";
import type { DashboardMenuItem, TaxConfigOption } from "@/services/menu/menu.types";

interface MenuItemCardProps {
  item: DashboardMenuItem;
  taxConfigs: TaxConfigOption[];
  categoryId: string;
  onEdit: () => void;
}

type ConfirmDialogType = "remove-from-category" | "delete-item";

export function MenuItemCard({ item, taxConfigs, categoryId, onEdit }: MenuItemCardProps) {
  const [isPending, startTransition] = useTransition();
  const formatPrice = useDashboardFormatPrice();
  const isInMultipleCategories = item.categoryIds.length > 1;
  const [confirmDialogType, setConfirmDialogType] = useState<ConfirmDialogType | null>(null);

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
    if (isInMultipleCategories) {
      // Item is in multiple categories - ask what to do
      setConfirmDialogType("remove-from-category");
    } else {
      // Item is only in this category - deleting will remove it entirely
      setConfirmDialogType("delete-item");
    }
  };

  const handleConfirmDelete = () => {
    if (!confirmDialogType) return;

    setConfirmDialogType(null);

    if (confirmDialogType === "remove-from-category") {
      // Remove from this category only
      startTransition(async () => {
        await deleteMenuItemAction(item.id, { categoryId });
      });
    } else {
      // Delete item entirely
      startTransition(async () => {
        await deleteMenuItemAction(item.id);
      });
    }
  };

  const getConfirmDialogProps = () => {
    if (confirmDialogType === "remove-from-category") {
      return {
        title: "Remove from Category",
        message: `This item is in ${item.categoryIds.length} categories.\n\nClick Confirm to remove from this category only.\nClick Cancel to keep it.`,
        confirmText: "Remove",
        variant: "default" as const,
      };
    } else {
      return {
        title: "Delete Item",
        message: "Are you sure you want to delete this item?",
        confirmText: "Delete",
        variant: "destructive" as const,
      };
    }
  };

  const handleStatusChange = (newStatus: "active" | "inactive" | "out_of_stock") => {
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
      case "inactive":
        return (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
            Hidden
          </span>
        );
      case "out_of_stock":
        return (
          <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
            Out of Stock
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
      } ${item.status === "inactive" ? "opacity-60" : ""}`}
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
        className="flex items-center justify-between border-t px-3 py-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Status dropdown */}
        <Select
          value={item.status}
          onChange={(e) =>
            handleStatusChange(
              e.target.value as "active" | "inactive" | "out_of_stock"
            )
          }
          disabled={isPending}
          className="h-8 w-auto text-xs"
        >
          <option value="active">Active</option>
          <option value="out_of_stock">Out of Stock</option>
          <option value="inactive">Hidden</option>
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

      {confirmDialogType && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setConfirmDialogType(null)}
          onConfirm={handleConfirmDelete}
          {...getConfirmDialogProps()}
        />
      )}
    </div>
  );
}
