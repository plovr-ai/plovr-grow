"use client";

import Link from "next/link";
import type { TaxConfigOption } from "@/services/menu/menu.types";

interface TaxSelectorProps {
  taxConfigs: TaxConfigOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function TaxSelector({
  taxConfigs,
  selectedIds,
  onChange,
  disabled,
}: TaxSelectorProps) {
  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  if (taxConfigs.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No tax types configured.{" "}
        <Link href="/dashboard/menu/tax" className="text-theme-primary hover:underline">
          Add tax types
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {taxConfigs.map((config) => (
        <label
          key={config.id}
          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
            selectedIds.includes(config.id)
              ? "border-theme-primary bg-theme-primary-light"
              : "border-gray-200 hover:border-gray-300"
          } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        >
          <input
            type="checkbox"
            checked={selectedIds.includes(config.id)}
            onChange={() => handleToggle(config.id)}
            disabled={disabled}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-theme-primary"
          />
          <div className="flex-1">
            <span className="font-medium text-gray-900">{config.name}</span>
            {config.description && (
              <p className="mt-0.5 text-xs text-gray-500">{config.description}</p>
            )}
          </div>
        </label>
      ))}
    </div>
  );
}
