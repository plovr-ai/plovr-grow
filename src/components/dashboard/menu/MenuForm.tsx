"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TextField, TextareaField, RadioGroupField } from "@/components/dashboard/Form";
import {
  createMenuAction,
  updateMenuAction,
  deleteMenuAction,
} from "@/app/(dashboard)/dashboard/(protected)/menu/actions";
import type { MenuInfo } from "@/services/menu/menu.types";

interface MenuFormProps {
  menu: MenuInfo | null;
  onClose: () => void;
  canDelete?: boolean;
}

export function MenuForm({ menu, onClose, canDelete = true }: MenuFormProps) {
  const isEditing = !!menu;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Form state
  const [name, setName] = useState(menu?.name ?? "");
  const [description, setDescription] = useState(menu?.description ?? "");
  const [status, setStatus] = useState<"active" | "inactive">(
    menu?.status ?? "active"
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    startTransition(async () => {
      const result = isEditing
        ? await updateMenuAction(menu!.id, {
            name: name.trim(),
            description: description.trim() || undefined,
            status,
          })
        : await createMenuAction({
            name: name.trim(),
            description: description.trim() || undefined,
          });

      if (result.success) {
        onClose();
      } else {
        setError(result.error || "An error occurred");
      }
    });
  };

  const handleDelete = () => {
    if (!isEditing || !canDelete) return;
    setShowConfirmDialog(true);
  };

  const handleConfirmDelete = () => {
    setShowConfirmDialog(false);

    startTransition(async () => {
      const result = await deleteMenuAction(menu!.id);
      if (result.success) {
        onClose();
      } else {
        setError(result.error || "Failed to delete menu");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-lg font-semibold">
            {isEditing ? "Edit Menu" : "Add Menu"}
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
            <TextField
              id="name"
              label="Name"
              required
              value={name}
              onChange={setName}
              placeholder="e.g., Lunch Menu, Dinner Menu"
              disabled={isPending}
            />

            <TextareaField
              id="description"
              label="Description"
              value={description}
              onChange={setDescription}
              placeholder="Optional description"
              disabled={isPending}
            />

            {isEditing && (
              <RadioGroupField
                id="status"
                name="status"
                label="Status"
                value={status}
                onChange={(value) => setStatus(value as "active" | "inactive")}
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Hidden" },
                ]}
                disabled={isPending}
              />
            )}
          </div>

          <div className="mt-6 flex justify-between border-t pt-4">
            {isEditing && canDelete ? (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isPending}
              >
                Delete Menu
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-3">
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
          </div>
        </form>
      </div>

      <ConfirmDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Menu"
        message="Are you sure you want to delete this menu? All categories and items in this menu will be hidden."
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}
