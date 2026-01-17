"use client";

import { useState, useCallback, useEffect } from "react";
import type {
  MenuItemViewModel,
  ModifierGroupViewModel,
  ModifierViewModel,
} from "@/types/menu-page";
import type { SelectedModifier } from "@/types";
import { useFormatPrice } from "@/hooks";

interface ModifierModalProps {
  item: MenuItemViewModel;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedModifiers: SelectedModifier[], quantity: number) => void;
}

interface SelectionState {
  [groupId: string]: Set<string>; // Set of modifier IDs selected in each group
}

export function ModifierModal({
  item,
  isOpen,
  onClose,
  onConfirm,
}: ModifierModalProps) {
  const formatPrice = useFormatPrice();

  // State for selected modifiers per group
  const [selections, setSelections] = useState<SelectionState>({});
  const [quantity, setQuantity] = useState(1);

  // Initialize default selections when modal opens
  useEffect(() => {
    if (isOpen) {
      const initialSelections: SelectionState = {};
      item.modifierGroups.forEach((group) => {
        const defaultModifiers = group.modifiers
          .filter((m) => m.isDefault && m.isAvailable)
          .map((m) => m.id);
        initialSelections[group.id] = new Set(defaultModifiers);
      });
      setSelections(initialSelections);
      setQuantity(1);
    }
  }, [isOpen, item.modifierGroups]);

  // Toggle modifier selection
  const handleToggleModifier = useCallback(
    (groupId: string, modifierId: string, group: ModifierGroupViewModel) => {
      setSelections((prev) => {
        const currentSet = new Set(prev[groupId] || []);

        if (currentSet.has(modifierId)) {
          // Remove if already selected
          currentSet.delete(modifierId);
        } else {
          // Add if not at max selections
          if (currentSet.size < group.maxSelections) {
            currentSet.add(modifierId);
          }
        }

        return { ...prev, [groupId]: currentSet };
      });
    },
    []
  );

  // Validate all required groups have minimum selections
  const isValid = useCallback(() => {
    return item.modifierGroups.every((group) => {
      if (!group.required) return true;
      const selectedCount = selections[group.id]?.size || 0;
      return selectedCount >= group.minSelections;
    });
  }, [item.modifierGroups, selections]);

  // Build selected modifiers array
  const buildSelectedModifiers = useCallback((): SelectedModifier[] => {
    const result: SelectedModifier[] = [];

    item.modifierGroups.forEach((group) => {
      const selectedIds = selections[group.id] || new Set();
      selectedIds.forEach((modifierId) => {
        const modifier = group.modifiers.find((m) => m.id === modifierId);
        if (modifier) {
          result.push({
            groupId: group.id,
            groupName: group.name,
            modifierId: modifier.id,
            modifierName: modifier.name,
            price: modifier.price,
          });
        }
      });
    });

    return result;
  }, [item.modifierGroups, selections]);

  const handleConfirm = useCallback(() => {
    if (isValid()) {
      onConfirm(buildSelectedModifiers(), quantity);
      onClose();
    }
  }, [isValid, buildSelectedModifiers, quantity, onConfirm, onClose]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    // Modal overlay
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal content */}
      <div className="relative bg-white rounded-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start gap-4">
            {item.imageUrl && (
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-900">{item.name}</h2>
              {item.description && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                  {item.description}
                </p>
              )}
              <p className="text-lg font-semibold text-gray-900 mt-2">
                {formatPrice(item.price)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Modifier groups (scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {item.modifierGroups.map((group) => (
            <ModifierGroupSection
              key={group.id}
              group={group}
              selectedIds={selections[group.id] || new Set()}
              onToggle={(modifierId) =>
                handleToggleModifier(group.id, modifierId, group)
              }
              formatPrice={formatPrice}
            />
          ))}
        </div>

        {/* Footer with quantity and add button */}
        <div className="p-6 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between">
            <QuantitySelector value={quantity} onChange={setQuantity} />
            <button
              onClick={handleConfirm}
              disabled={!isValid()}
              className={`px-6 py-3 rounded-full font-semibold transition-colors ${
                isValid()
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Sub-component for each modifier group
function ModifierGroupSection({
  group,
  selectedIds,
  onToggle,
  formatPrice,
}: {
  group: ModifierGroupViewModel;
  selectedIds: Set<string>;
  onToggle: (modifierId: string) => void;
  formatPrice: (price: number) => string;
}) {
  const getSelectionHint = () => {
    if (group.required) {
      if (group.minSelections === group.maxSelections) {
        return `Required - Select ${group.minSelections}`;
      }
      return `Required - Select ${group.minSelections} to ${group.maxSelections}`;
    }
    if (group.maxSelections === 1) {
      return "Optional - Select up to 1";
    }
    return `Optional - Select up to ${group.maxSelections}`;
  };

  return (
    <div>
      <div className="mb-3">
        <h3 className="font-semibold text-gray-900">{group.name}</h3>
        <p className="text-sm text-gray-500">{getSelectionHint()}</p>
      </div>
      <div className="space-y-2">
        {group.modifiers.map((modifier) => (
          <ModifierCheckbox
            key={modifier.id}
            modifier={modifier}
            isSelected={selectedIds.has(modifier.id)}
            onToggle={() => onToggle(modifier.id)}
            formatPrice={formatPrice}
          />
        ))}
      </div>
    </div>
  );
}

// Sub-component for each modifier checkbox
function ModifierCheckbox({
  modifier,
  isSelected,
  onToggle,
  formatPrice,
}: {
  modifier: ModifierViewModel;
  isSelected: boolean;
  onToggle: () => void;
  formatPrice: (price: number) => string;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={!modifier.isAvailable}
      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
        isSelected
          ? "border-red-500 bg-red-50"
          : modifier.isAvailable
            ? "border-gray-200 hover:border-gray-300"
            : "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
            isSelected ? "bg-red-600 border-red-600" : "border-gray-300"
          }`}
        >
          {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
        </div>
        <span
          className={modifier.isAvailable ? "text-gray-900" : "text-gray-400"}
        >
          {modifier.name}
        </span>
      </div>
      {modifier.price > 0 && (
        <span className="text-gray-500">+{formatPrice(modifier.price)}</span>
      )}
    </button>
  );
}

// Quantity selector component
function QuantitySelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(Math.max(1, value - 1))}
        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors"
        aria-label="Decrease quantity"
      >
        <MinusIcon className="w-4 h-4 text-gray-600" />
      </button>
      <span className="w-8 text-center font-semibold">{value}</span>
      <button
        onClick={() => onChange(value + 1)}
        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors"
        aria-label="Increase quantity"
      >
        <PlusIcon className="w-4 h-4 text-gray-600" />
      </button>
    </div>
  );
}

// Icon components
function CloseIcon() {
  return (
    <svg
      className="w-6 h-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={3}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function MinusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20 12H4"
      />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4v16m8-8H4"
      />
    </svg>
  );
}
