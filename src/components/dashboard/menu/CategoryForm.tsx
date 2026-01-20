"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUploader } from "./ImageUploader";
import {
  createCategoryAction,
  updateCategoryAction,
} from "@/app/(dashboard)/dashboard/(protected)/menu/actions";
import type { DashboardCategory } from "@/services/menu/menu.types";

interface CategoryFormProps {
  category: DashboardCategory | null;
  onClose: () => void;
}

export function CategoryForm({ category, onClose }: CategoryFormProps) {
  const isEditing = !!category;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [imageUrl, setImageUrl] = useState(category?.imageUrl ?? "");
  const [status, setStatus] = useState<"active" | "inactive">(
    category?.status ?? "active"
  );

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
            status,
          })
        : await createCategoryAction({
            name: name.trim(),
            description: description.trim() || undefined,
            imageUrl: imageUrl.trim() || undefined,
          });

      if (result.success) {
        onClose();
      } else {
        setError(result.error || "An error occurred");
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
            <div className="grid grid-cols-[120px_1fr] items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Appetizers, Main Dishes"
                disabled={isPending}
              />
            </div>

            {/* Description */}
            <div className="grid grid-cols-[120px_1fr] items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                disabled={isPending}
              />
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
