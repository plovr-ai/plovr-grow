"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUploader } from "./ImageUploader";
import { TaxSelector } from "./TaxSelector";
import { ModifierGroupEditor } from "./ModifierGroupEditor";
import {
  createMenuItemAction,
  updateMenuItemAction,
} from "@/app/(dashboard)/dashboard/(protected)/menu/actions";
import type {
  DashboardMenuItem,
  TaxConfigOption,
  ModifierGroupInput,
} from "@/services/menu/menu.types";

interface MenuItemFormPageProps {
  item: DashboardMenuItem | null;
  categoryId: string;
  categoryName: string;
  taxConfigs: TaxConfigOption[];
}

export function MenuItemFormPage({
  item,
  categoryId,
  categoryName,
  taxConfigs,
}: MenuItemFormPageProps) {
  const router = useRouter();
  const isEditing = !!item;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [price, setPrice] = useState(item ? item.price.toString() : "");
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? "");
  const [status, setStatus] = useState<"active" | "inactive" | "out_of_stock">(
    item?.status ?? "active"
  );
  const [modifierGroups, setModifierGroups] = useState<ModifierGroupInput[]>(
    item?.modifierGroups ?? []
  );
  const [taxConfigIds, setTaxConfigIds] = useState<string[]>(
    item?.taxConfigIds ?? []
  );

  const handleBack = () => {
    router.push(`/dashboard/menu?category=${categoryId}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      setError("Price must be a valid non-negative number");
      return;
    }

    startTransition(async () => {
      const result = isEditing
        ? await updateMenuItemAction(item!.id, {
            name: name.trim(),
            description: description.trim() || undefined,
            price: priceNum,
            imageUrl: imageUrl.trim() || undefined,
            status,
            modifierGroups,
            taxConfigIds,
          })
        : await createMenuItemAction({
            categoryId,
            name: name.trim(),
            description: description.trim() || undefined,
            price: priceNum,
            imageUrl: imageUrl.trim() || undefined,
            modifierGroups,
            taxConfigIds,
          });

      if (result.success) {
        router.push(`/dashboard/menu?category=${categoryId}`);
      } else {
        setError(result.error || "An error occurred");
      }
    });
  };

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon-sm" onClick={handleBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold">
            {isEditing ? "Edit Menu Item" : "Add Menu Item"}
          </h2>
          <p className="text-sm text-gray-500">
            Category: {categoryName}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="rounded-lg border bg-white p-6">
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Basic Info Section */}
          <div className="space-y-5">
            <h4 className="font-medium text-gray-900">Basic Information</h4>

            {/* Name */}
            <div className="grid grid-cols-[120px_1fr] items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Classic Burger"
                disabled={isPending}
              />
            </div>

            {/* Description */}
            <div className="grid grid-cols-[120px_1fr] items-start gap-4">
              <Label htmlFor="description" className="pt-2 text-right">
                Description
              </Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your menu item..."
                disabled={isPending}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-theme-primary focus:outline-none focus:ring-1 focus:ring-theme-primary disabled:bg-gray-50"
              />
            </div>

            {/* Price */}
            <div className="grid grid-cols-[120px_1fr] items-center gap-4">
              <Label htmlFor="price" className="text-right">
                Price <span className="text-red-500">*</span>
              </Label>
              <div className="relative max-w-[200px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  $
                </span>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  disabled={isPending}
                  className="pl-7"
                />
              </div>
            </div>

            {/* Image */}
            <div className="grid grid-cols-[120px_1fr] items-start gap-4">
              <Label className="pt-2 text-right">Image</Label>
              <ImageUploader
                value={imageUrl}
                onChange={setImageUrl}
                disabled={isPending}
              />
            </div>

            {/* Status (only for editing) */}
            {isEditing && (
              <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                <Label className="text-right">Status</Label>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="status"
                      value="active"
                      checked={status === "active"}
                      onChange={() => setStatus("active")}
                      disabled={isPending}
                      className="h-4 w-4 text-theme-primary"
                    />
                    <span className="text-sm">Active</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="status"
                      value="out_of_stock"
                      checked={status === "out_of_stock"}
                      onChange={() => setStatus("out_of_stock")}
                      disabled={isPending}
                      className="h-4 w-4 text-theme-primary"
                    />
                    <span className="text-sm">Out of Stock</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="status"
                      value="inactive"
                      checked={status === "inactive"}
                      onChange={() => setStatus("inactive")}
                      disabled={isPending}
                      className="h-4 w-4 text-theme-primary"
                    />
                    <span className="text-sm">Hidden</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Modifiers Section */}
          <div className="border-t pt-6">
            <h4 className="mb-4 font-medium text-gray-900">Modifiers</h4>
            <ModifierGroupEditor
              groups={modifierGroups}
              onChange={setModifierGroups}
              disabled={isPending}
            />
          </div>

          {/* Tax Section */}
          <div className="border-t pt-6">
            <h4 className="mb-4 font-medium text-gray-900">Tax Configuration</h4>
            <TaxSelector
              taxConfigs={taxConfigs}
              selectedIds={taxConfigIds}
              onChange={setTaxConfigIds}
              disabled={isPending}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex justify-end gap-3 border-t pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : isEditing ? "Save Changes" : "Create Item"}
          </Button>
        </div>
      </form>
    </div>
  );
}
