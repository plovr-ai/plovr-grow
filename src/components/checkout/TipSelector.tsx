"use client";

import { useState, useEffect, useMemo } from "react";
import { useFormatPrice, useCurrencySymbol } from "@/hooks";
import { useTipConfig } from "@/contexts";
import { TipOptionButton } from "./TipOptionButton";
import { TipOptionInput } from "./TipOptionInput";
import type { TipInput } from "@/lib/pricing";
import type { TipConfig } from "@/types";

interface TipSelectorProps {
  subtotal: number;
  value: TipInput | null;
  onChange: (tip: TipInput | null) => void;
  disabled?: boolean;
}

type TipOptionType = "none" | "percentage" | "fixed" | "custom";

interface TipOption {
  type: TipOptionType;
  value?: number; // percentage (0.15) or fixed amount (1)
  label: string;
}

function buildTipOptions(config: TipConfig): TipOption[] {
  const options: TipOption[] = [{ type: "none", label: "None" }];

  config.tiers.forEach((tier) => {
    if (config.mode === "percentage") {
      options.push({
        type: "percentage",
        value: tier,
        label: `${Math.round(tier * 100)}%`,
      });
    } else {
      options.push({
        type: "fixed",
        value: tier,
        label: `$${tier.toFixed(2)}`,
      });
    }
  });

  return options;
}

export function TipSelector({
  subtotal,
  value,
  onChange,
  disabled = false,
}: TipSelectorProps) {
  const formatPrice = useFormatPrice();
  const currencySymbol = useCurrencySymbol();
  const tipConfig = useTipConfig();

  const tipOptions = useMemo(() => buildTipOptions(tipConfig), [tipConfig]);

  const [activeType, setActiveType] = useState<TipOptionType>("none");
  const [customValue, setCustomValue] = useState("");

  // Sync activeType with external value changes
  useEffect(() => {
    if (value === null) {
      if (activeType !== "custom") {
        setActiveType("none");
      }
    } else if (value.type === "percentage") {
      setActiveType("percentage");
    } else if (value.type === "fixed") {
      // Check if this is a custom value or a preset fixed value
      const isPresetFixed = tipConfig.mode === "fixed" &&
        tipConfig.tiers.includes(value.amount);
      setActiveType(isPresetFixed ? "fixed" : "custom");
      if (!isPresetFixed) {
        setCustomValue(String(value.amount));
      }
    }
  }, [value, activeType, tipConfig]);

  const handleSelect = (option: TipOption) => {
    setActiveType(option.type);

    if (option.type === "none") {
      onChange(null);
      setCustomValue("");
    } else if (option.type === "percentage" && option.value !== undefined) {
      onChange({ type: "percentage", percentage: option.value });
      setCustomValue("");
    } else if (option.type === "fixed" && option.value !== undefined) {
      onChange({ type: "fixed", amount: option.value });
      setCustomValue("");
    }
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
    if (value?.type === "percentage") {
      onChange(null);
    }
  };

  const isSelected = (option: TipOption): boolean => {
    if (option.type === "none") {
      return activeType === "none";
    }
    if (option.type === "percentage") {
      return (
        activeType === "percentage" &&
        value?.type === "percentage" &&
        value.percentage === option.value
      );
    }
    if (option.type === "fixed") {
      return (
        activeType === "fixed" &&
        value?.type === "fixed" &&
        value.amount === option.value
      );
    }
    return false;
  };

  const isCustomSelected = activeType === "custom";

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <h2 className="text-sm font-medium text-gray-700 mb-3">Add a Tip</h2>
      <div className="flex flex-wrap items-center gap-2">
        {tipOptions.map((option, index) => (
          <TipOptionButton
            key={index}
            selected={isSelected(option)}
            disabled={disabled}
            onClick={() => handleSelect(option)}
          >
            {option.label}
            {option.type === "percentage" && option.value && option.value > 0 && (
              <span className="ml-1 text-xs text-gray-500">
                ({formatPrice(subtotal * option.value)})
              </span>
            )}
          </TipOptionButton>
        ))}

        {tipConfig.allowCustom && (
          <TipOptionInput
            selected={isCustomSelected}
            disabled={disabled}
            value={customValue}
            currencySymbol={currencySymbol}
            onChange={handleCustomChange}
            onFocus={handleCustomFocus}
          />
        )}
      </div>
    </div>
  );
}
