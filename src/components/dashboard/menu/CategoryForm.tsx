"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  TextField,
  FormField,
} from "@/components/dashboard/Form";
import { ImageUploader } from "./ImageUploader";
import {
  createCategoryAction,
  updateCategoryAction,
} from "@/app/(dashboard)/dashboard/(protected)/menu/actions";
import { getApiErrorMessage } from "@/lib/api";
import type { DashboardCategory } from "@/services/menu/menu.types";

interface CategoryFormProps {
  menuId: string;
  category: DashboardCategory | null;
  onClose: () => void;
}

export function CategoryForm({ menuId, category, onClose }: CategoryFormProps) {
  const isEditing = !!category;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [imageUrl, setImageUrl] = useState(category?.imageUrl ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    startTransition(async () => {
      const result = isEditing
        ? await updateCategoryAction(category!.id, {
            name: name.trim(),
            description: description.trim() || undefined,
            imageUrl: imageUrl.trim() || undefined,
          })
        : await createCategoryAction({
            menuId,
            name: name.trim(),
            description: description.trim() || undefined,
            imageUrl: imageUrl.trim() || undefined,
          });

      if (result.success) {
        onClose();
      } else {
        setError(getApiErrorMessage(result.error, "An error occurred"));
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-lg font-semibold">
            {isEditing ? "Edit Category" : "Add Category"}
          </h3>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-5">
            {/* Name */}
            <TextField
              id="name"
              label="Name"
              required
              value={name}
              onChange={setName}
              placeholder="e.g., Appetizers, Main Dishes"
              disabled={isPending}
            />

            {/* Description */}
            <TextField
              id="description"
              label="Description"
              value={description}
              onChange={setDescription}
              placeholder="Optional description"
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
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : isEditing ? "Save Changes" : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
