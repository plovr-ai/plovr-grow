"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  TextField,
  TextareaField,
  PriceField,
  RadioGroupField,
  FormField,
} from "@/components/dashboard/Form";
import { ImageUploader } from "./ImageUploader";
import { TaxSelector } from "./TaxSelector";
import { ModifierGroupEditor } from "./ModifierGroupEditor";
import {
  createMenuItemAction,
  updateMenuItemAction,
} from "@/app/(dashboard)/dashboard/(protected)/menu/actions";
import type {
  DashboardMenuItem,
  DashboardCategory,
  TaxConfigOption,
  ModifierGroupInput,
} from "@/services/menu/menu.types";

interface MenuItemFormPageProps {
  item: DashboardMenuItem | null;
  categoryId: string;
  categoryName: string;
  categories: DashboardCategory[];
  taxConfigs: TaxConfigOption[];
}

export function MenuItemFormPage({
  item,
  categoryId,
  categoryName,
  categories,
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
  const [status, setStatus] = useState<"active" | "out_of_stock" | "archived">(
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
            categoryIds: [categoryId],
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
    <div>
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
            <TextField
              id="name"
              label="Name"
              required
              value={name}
              onChange={setName}
              placeholder="e.g., Classic Burger"
              disabled={isPending}
            />

            {/* Description */}
            <TextareaField
              id="description"
              label="Description"
              value={description}
              onChange={setDescription}
              placeholder="Describe your menu item..."
              disabled={isPending}
              rows={3}
            />

            {/* Price */}
            <PriceField
              id="price"
              label="Price"
              required
              value={price}
              onChange={setPrice}
              placeholder="0.00"
              disabled={isPending}
            />

            {/* Image */}
            <FormField id="image" label="Image" alignTop>
              <ImageUploader
                value={imageUrl}
                onChange={setImageUrl}
                disabled={isPending}
              />
            </FormField>

            {/* Status (only for editing) */}
            {isEditing && (
              <RadioGroupField
                id="status"
                name="status"
                label="Status"
                value={status}
                onChange={(value) =>
                  setStatus(value as "active" | "out_of_stock")
                }
                options={[
                  { value: "active", label: "Active" },
                  { value: "out_of_stock", label: "Out of Stock" },
                ]}
                disabled={isPending}
              />
            )}

            {/* Categories (only for editing) */}
            {isEditing && item && (
              <FormField id="categories" label="Categories">
                {item.categoryIds.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {item.categoryIds.map((catId) => {
                      const category = categories.find((c) => c.id === catId);
                      return category ? (
                        <span
                          key={catId}
                          className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
                        >
                          {category.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                ) : (
                  <span className="text-sm text-gray-500">No category assigned</span>
                )}
              </FormField>
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
