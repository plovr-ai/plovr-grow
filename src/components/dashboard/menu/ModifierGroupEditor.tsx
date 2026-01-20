"use client";

import { useState } from "react";
import { Plus, Trash2, GripVertical, X, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDashboardFormatPrice, useDashboardCurrencySymbol } from "@/hooks";
import {
  TextField,
  RadioGroupField,
  FormField,
} from "@/components/dashboard/Form";
import type { ModifierGroupInput, ModifierInput } from "@/services/menu/menu.types";

interface ModifierGroupEditorProps {
  groups: ModifierGroupInput[];
  onChange: (groups: ModifierGroupInput[]) => void;
  disabled?: boolean;
}

interface ModifierGroupFormData {
  name: string;
  type: "single" | "multiple";
  required: boolean;
  allowQuantity: boolean;
  maxQuantityPerModifier: number;
  modifiers: ModifierInput[];
}

export function ModifierGroupEditor({
  groups,
  onChange,
  disabled,
}: ModifierGroupEditorProps) {
  const formatPrice = useDashboardFormatPrice();
  const currencySymbol = useDashboardCurrencySymbol();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [editingGroup, setEditingGroup] = useState<{
    index: number;
    data: ModifierGroupFormData;
  } | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const toggleExpand = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAddGroup = () => {
    setEditingGroup(null);
    setIsAddingNew(true);
  };

  const handleEditGroup = (index: number) => {
    const group = groups[index];
    setEditingGroup({
      index,
      data: {
        name: group.name,
        type: group.type,
        required: group.required,
        allowQuantity: group.allowQuantity ?? false,
        maxQuantityPerModifier: group.maxQuantityPerModifier ?? 1,
        modifiers: [...group.modifiers],
      },
    });
    setIsAddingNew(false);
  };

  const handleDeleteGroup = (index: number) => {
    if (!confirm("Are you sure you want to delete this modifier group?")) {
      return;
    }
    const newGroups = [...groups];
    newGroups.splice(index, 1);
    onChange(newGroups);
  };

  const handleSaveGroup = (data: ModifierGroupFormData) => {
    const groupData: ModifierGroupInput = {
      id: editingGroup ? groups[editingGroup.index].id : crypto.randomUUID(),
      name: data.name,
      type: data.type,
      required: data.required,
      allowQuantity: data.allowQuantity || undefined,
      maxQuantityPerModifier: data.allowQuantity ? data.maxQuantityPerModifier : undefined,
      modifiers: data.modifiers,
    };

    if (editingGroup) {
      const newGroups = [...groups];
      newGroups[editingGroup.index] = groupData;
      onChange(newGroups);
    } else {
      onChange([...groups, groupData]);
    }

    setEditingGroup(null);
    setIsAddingNew(false);
  };

  const handleCancelEdit = () => {
    setEditingGroup(null);
    setIsAddingNew(false);
  };

  // If editing or adding, show the form
  if (isAddingNew || editingGroup) {
    return (
      <ModifierGroupForm
        initialData={editingGroup?.data}
        onSave={handleSaveGroup}
        onCancel={handleCancelEdit}
        disabled={disabled}
      />
    );
  }

  return (
    <div className="space-y-3">
      {groups.length === 0 ? (
        <p className="text-sm text-gray-500">No modifier groups yet</p>
      ) : (
        groups.map((group, index) => (
          <div
            key={group.id}
            className="rounded-lg border bg-gray-50"
          >
            {/* Group header */}
            <div className="flex items-center gap-2 p-3">
              <button
                type="button"
                onClick={() => toggleExpand(group.id)}
                className="text-gray-400 hover:text-gray-600"
              >
                {expandedGroups.has(group.id) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              <div className="flex-1">
                <span className="font-medium">{group.name}</span>
                <span className="ml-2 text-xs text-gray-500">
                  {group.type === "single" ? "Single" : "Multiple"} select
                  {group.required && " (Required)"}
                </span>
              </div>
              <span className="text-xs text-gray-400">
                {group.modifiers.length} option{group.modifiers.length !== 1 ? "s" : ""}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => handleEditGroup(index)}
                disabled={disabled}
              >
                <GripVertical className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => handleDeleteGroup(index)}
                disabled={disabled}
                className="text-red-500 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Expanded content */}
            {expandedGroups.has(group.id) && (
              <div className="border-t px-3 py-2">
                <div className="space-y-1">
                  {group.modifiers.map((mod) => (
                    <div
                      key={mod.id}
                      className="flex items-center justify-between rounded bg-white px-2 py-1 text-sm"
                    >
                      <span className={mod.isAvailable === false ? "text-gray-400" : ""}>
                        {mod.name}
                        {mod.isDefault && (
                          <span className="ml-1 text-xs text-gray-400">(default)</span>
                        )}
                      </span>
                      <span className="text-gray-600">
                        {mod.price > 0 ? `+${formatPrice(mod.price)}` : "Free"}
                      </span>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditGroup(index)}
                  disabled={disabled}
                  className="mt-2"
                >
                  Edit options
                </Button>
              </div>
            )}
          </div>
        ))
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAddGroup}
        disabled={disabled}
        className="w-full"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Modifier Group
      </Button>
    </div>
  );
}

// Internal form component for editing a modifier group
interface ModifierGroupFormProps {
  initialData?: ModifierGroupFormData;
  onSave: (data: ModifierGroupFormData) => void;
  onCancel: () => void;
  disabled?: boolean;
}

function ModifierGroupForm({
  initialData,
  onSave,
  onCancel,
  disabled,
}: ModifierGroupFormProps) {
  const formatPrice = useDashboardFormatPrice();
  const currencySymbol = useDashboardCurrencySymbol();
  const [name, setName] = useState(initialData?.name ?? "");
  const [type, setType] = useState<"single" | "multiple">(initialData?.type ?? "single");
  const [required, setRequired] = useState(initialData?.required ?? false);
  const [allowQuantity, setAllowQuantity] = useState(initialData?.allowQuantity ?? false);
  const [maxQuantity, setMaxQuantity] = useState(
    initialData?.maxQuantityPerModifier ?? 1
  );
  const [modifiers, setModifiers] = useState<ModifierInput[]>(
    initialData?.modifiers ?? []
  );
  const [error, setError] = useState<string | null>(null);

  // New modifier form state
  const [newModName, setNewModName] = useState("");
  const [newModPrice, setNewModPrice] = useState("");

  const handleAddModifier = () => {
    if (!newModName.trim()) return;

    const price = parseFloat(newModPrice) || 0;
    const newMod: ModifierInput = {
      id: crypto.randomUUID(),
      name: newModName.trim(),
      price,
      isDefault: modifiers.length === 0, // First modifier is default
      isAvailable: true,
    };

    setModifiers([...modifiers, newMod]);
    setNewModName("");
    setNewModPrice("");
  };

  const handleRemoveModifier = (id: string) => {
    setModifiers(modifiers.filter((m) => m.id !== id));
  };

  const handleToggleDefault = (id: string) => {
    if (type === "single") {
      // Only one default for single select
      setModifiers(
        modifiers.map((m) => ({
          ...m,
          isDefault: m.id === id,
        }))
      );
    } else {
      // Toggle for multiple select
      setModifiers(
        modifiers.map((m) =>
          m.id === id ? { ...m, isDefault: !m.isDefault } : m
        )
      );
    }
  };

  const handleSave = () => {
    setError(null);

    if (!name.trim()) {
      setError("Group name is required");
      return;
    }

    if (modifiers.length === 0) {
      setError("At least one modifier is required");
      return;
    }

    onSave({
      name: name.trim(),
      type,
      required,
      allowQuantity,
      maxQuantityPerModifier: maxQuantity,
      modifiers,
    });
  };

  return (
    <div className="space-y-5 rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">
          {initialData ? "Edit Modifier Group" : "New Modifier Group"}
        </h4>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onCancel}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Group name */}
      <TextField
        id="groupName"
        label="Name"
        required
        value={name}
        onChange={setName}
        placeholder="e.g., Size, Toppings"
        disabled={disabled}
        labelWidth={100}
      />

      {/* Type */}
      <RadioGroupField
        id="type"
        name="type"
        label="Type"
        value={type}
        onChange={(value) => setType(value as "single" | "multiple")}
        options={[
          { value: "single", label: "Single select" },
          { value: "multiple", label: "Multiple select" },
        ]}
        disabled={disabled}
        labelWidth={100}
      />

      {/* Required & Allow quantity */}
      <FormField id="options" label="Options" alignTop labelWidth={100}>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              disabled={disabled}
              className="h-4 w-4 rounded"
            />
            <span className="text-sm">Required</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={allowQuantity}
              onChange={(e) => setAllowQuantity(e.target.checked)}
              disabled={disabled}
              className="h-4 w-4 rounded"
            />
            <span className="text-sm">Allow quantity per modifier</span>
          </label>
          {allowQuantity && (
            <div className="flex items-center gap-2 pl-6">
              <span className="text-sm text-gray-600">Max quantity:</span>
              <Input
                type="number"
                min="1"
                value={maxQuantity}
                onChange={(e) => setMaxQuantity(parseInt(e.target.value) || 1)}
                disabled={disabled}
                className="w-20"
              />
            </div>
          )}
        </div>
      </FormField>

      {/* Modifiers list */}
      <FormField id="modifiers" label="Modifiers" alignTop labelWidth={100}>
        <div className="space-y-2">
          {modifiers.map((mod) => (
            <div
              key={mod.id}
              className="flex items-center gap-2 rounded border bg-gray-50 p-2"
            >
              <input
                type={type === "single" ? "radio" : "checkbox"}
                checked={mod.isDefault}
                onChange={() => handleToggleDefault(mod.id)}
                disabled={disabled}
                className="h-4 w-4"
              />
              <span className="flex-1 text-sm">{mod.name}</span>
              <span className="text-sm text-gray-600">
                {mod.price > 0 ? `+${formatPrice(mod.price)}` : "Free"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => handleRemoveModifier(mod.id)}
                disabled={disabled}
                className="text-red-500 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          {/* Add new modifier */}
          <div className="flex gap-2">
            <Input
              value={newModName}
              onChange={(e) => setNewModName(e.target.value)}
              placeholder="Option name"
              disabled={disabled}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddModifier();
                }
              }}
            />
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-400">{currencySymbol}</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={newModPrice}
                onChange={(e) => setNewModPrice(e.target.value)}
                placeholder="0.00"
                disabled={disabled}
                className="w-20"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddModifier();
                  }
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddModifier}
              disabled={disabled || !newModName.trim()}
            >
              Add
            </Button>
          </div>
        </div>
      </FormField>

      {/* Actions */}
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={disabled}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={disabled}
        >
          Save Group
        </Button>
      </div>
    </div>
  );
}
