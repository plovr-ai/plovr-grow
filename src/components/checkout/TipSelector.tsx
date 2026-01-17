"use client";

import { useState, useEffect } from "react";
import { useFormatPrice, useCurrencySymbol } from "@/hooks";
import { TipOptionButton } from "./TipOptionButton";
import { TipOptionInput } from "./TipOptionInput";
import type { TipInput } from "@/lib/pricing";

interface TipSelectorProps {
  subtotal: number;
  value: TipInput | null;
  onChange: (tip: TipInput | null) => void;
  disabled?: boolean;
}

type TipOptionType = "none" | "percentage" | "custom";

interface TipOption {
  type: TipOptionType;
  percentage?: number;
  label: string;
}

const TIP_OPTIONS: TipOption[] = [
  { type: "none", label: "None" },
  { type: "percentage", percentage: 0.15, label: "15%" },
  { type: "percentage", percentage: 0.18, label: "18%" },
  { type: "percentage", percentage: 0.2, label: "20%" },
  { type: "custom", label: "Custom" },
];

export function TipSelector({
  subtotal,
  value,
  onChange,
  disabled = false,
}: TipSelectorProps) {
  const formatPrice = useFormatPrice();
  const currencySymbol = useCurrencySymbol();

  // Unified state management
  const [activeType, setActiveType] = useState<TipOptionType>("none");
  const [customValue, setCustomValue] = useState("");

  // Sync activeType with external value changes
  useEffect(() => {
    if (value === null) {
      // Only reset to "none" if not in custom mode with empty input
      if (activeType !== "custom") {
        setActiveType("none");
      }
    } else if (value.type === "percentage") {
      setActiveType("percentage");
    } else if (value.type === "fixed") {
      setActiveType("custom");
      setCustomValue(String(value.amount));
    }
  }, [value, activeType]);

  const handleSelect = (option: TipOption) => {
    setActiveType(option.type);

    if (option.type === "none") {
      onChange(null);
      setCustomValue("");
    } else if (option.type === "percentage" && option.percentage !== undefined) {
      onChange({ type: "percentage", percentage: option.percentage });
      setCustomValue("");
    }
    // custom type is handled by input onChange
  };

  const handleCustomChange = (inputValue: string) => {
    setCustomValue(inputValue);
    const numValue = parseFloat(inputValue);

    if (inputValue === "" || isNaN(numValue) || numValue <= 0) {
      onChange(null);
    } else {
      onChange({ type: "fixed", amount: Math.round(numValue * 100) / 100 });
    }
  };

  const handleCustomFocus = () => {
    setActiveType("custom");
    // Clear percentage selection when focusing on custom
    if (value?.type === "percentage") {
      onChange(null);
    }
  };

  // Check if an option is selected
  const isSelected = (option: TipOption): boolean => {
    if (option.type === "none") {
      return activeType === "none";
    }
    if (option.type === "custom") {
      return activeType === "custom";
    }
    if (option.type === "percentage") {
      return (
        activeType === "percentage" &&
        value?.type === "percentage" &&
        value.percentage === option.percentage
      );
    }
    return false;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <h2 className="text-sm font-medium text-gray-700 mb-3">Add a Tip</h2>
      <div className="flex flex-wrap items-center gap-2">
        {TIP_OPTIONS.map((option) =>
          option.type === "custom" ? (
            <TipOptionInput
              key="custom"
              selected={isSelected(option)}
              disabled={disabled}
              value={customValue}
              currencySymbol={currencySymbol}
              onChange={handleCustomChange}
              onFocus={handleCustomFocus}
            />
          ) : (
            <TipOptionButton
              key={option.label}
              selected={isSelected(option)}
              disabled={disabled}
              onClick={() => handleSelect(option)}
            >
              {option.label}
              {option.percentage && option.percentage > 0 && (
                <span className="ml-1 text-xs text-gray-500">
                  ({formatPrice(subtotal * option.percentage)})
                </span>
              )}
            </TipOptionButton>
          )
        )}
      </div>
    </div>
  );
}
