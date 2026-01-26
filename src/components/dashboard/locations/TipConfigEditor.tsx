"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";
import type { TipConfig, TipMode } from "@/types";

interface TipConfigEditorProps {
  value: TipConfig;
  onChange: (value: TipConfig) => void;
  disabled?: boolean;
}

export function TipConfigEditor({
  value,
  onChange,
  disabled,
}: TipConfigEditorProps) {
  const [newTier, setNewTier] = useState("");

  const handleModeChange = (mode: TipMode) => {
    // Reset tiers when mode changes
    const defaultTiers =
      mode === "percentage" ? [0.15, 0.18, 0.2] : [1, 2, 3];
    onChange({
      ...value,
      mode,
      tiers: defaultTiers,
    });
  };

  const handleAddTier = () => {
    const tierValue = parseFloat(newTier);
    if (isNaN(tierValue) || tierValue <= 0) return;

    // For percentage mode, convert if user entered whole number
    const finalValue =
      value.mode === "percentage" && tierValue > 1
        ? tierValue / 100
        : tierValue;

    if (!value.tiers.includes(finalValue)) {
      onChange({
        ...value,
        tiers: [...value.tiers, finalValue].sort((a, b) => a - b),
      });
    }
    setNewTier("");
  };

  const handleRemoveTier = (tierToRemove: number) => {
    onChange({
      ...value,
      tiers: value.tiers.filter((t) => t !== tierToRemove),
    });
  };

  const handleAllowCustomChange = (allowCustom: boolean) => {
    onChange({
      ...value,
      allowCustom,
    });
  };

  const formatTier = (tier: number) => {
    if (value.mode === "percentage") {
      return `${(tier * 100).toFixed(0)}%`;
    }
    return `$${tier.toFixed(2)}`;
  };

  return (
    <div className="space-y-4">
      {/* Mode Selection */}
      <div className="grid grid-cols-[120px_1fr] items-center gap-4">
        <span className="text-sm font-medium text-gray-700 text-right">
          Tip Mode
        </span>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="tipMode"
              checked={value.mode === "percentage"}
              onChange={() => handleModeChange("percentage")}
              disabled={disabled}
              className="h-4 w-4 text-theme-primary"
            />
            <span className="text-sm">Percentage</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="tipMode"
              checked={value.mode === "fixed"}
              onChange={() => handleModeChange("fixed")}
              disabled={disabled}
              className="h-4 w-4 text-theme-primary"
            />
            <span className="text-sm">Fixed Amount</span>
          </label>
        </div>
      </div>

      {/* Tip Tiers */}
      <div className="grid grid-cols-[120px_1fr] items-start gap-4">
        <span className="text-sm font-medium text-gray-700 text-right pt-2">
          Tip Options
        </span>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {value.tiers.map((tier) => (
              <div
                key={tier}
                className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1"
              >
                <span className="text-sm">{formatTier(tier)}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTier(tier)}
                  disabled={disabled}
                  className="ml-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={newTier}
              onChange={(e) => setNewTier(e.target.value)}
              placeholder={
                value.mode === "percentage" ? "e.g., 15 for 15%" : "e.g., 2.00"
              }
              disabled={disabled}
              className="w-40"
              step={value.mode === "percentage" ? "1" : "0.01"}
              min="0"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddTier}
              disabled={disabled || !newTier}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </div>
      </div>

      {/* Allow Custom */}
      <div className="grid grid-cols-[120px_1fr] items-center gap-4">
        <span className="text-sm font-medium text-gray-700 text-right">
          Custom Tip
        </span>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value.allowCustom}
            onChange={(e) => handleAllowCustomChange(e.target.checked)}
            disabled={disabled}
            className="h-4 w-4 rounded border-gray-300 text-theme-primary focus:ring-theme-primary"
          />
          <span className="text-sm text-gray-500">
            Allow customers to enter custom tip amount
          </span>
        </label>
      </div>
    </div>
  );
}
