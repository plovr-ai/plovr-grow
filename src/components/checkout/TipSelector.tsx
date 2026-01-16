"use client";

import { useState } from "react";
import { useFormatPrice } from "@/hooks";

interface TipSelectorProps {
  subtotal: number;
  value: number;
  onChange: (amount: number) => void;
  disabled?: boolean;
}

const TIP_PERCENTAGES = [
  { value: 0, label: "None" },
  { value: 0.15, label: "15%" },
  { value: 0.18, label: "18%" },
  { value: 0.2, label: "20%" },
];

export function TipSelector({
  subtotal,
  value,
  onChange,
  disabled = false,
}: TipSelectorProps) {
  const formatPrice = useFormatPrice();
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState("");

  const selectedPercentage = TIP_PERCENTAGES.find(
    (tip) => Math.abs(subtotal * tip.value - value) < 0.01
  );

  const handlePercentageClick = (percentage: number) => {
    setIsCustom(false);
    setCustomValue("");
    onChange(Math.round(subtotal * percentage * 100) / 100);
  };

  const handleCustomClick = () => {
    setIsCustom(true);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setCustomValue(inputValue);
    const numValue = parseFloat(inputValue);
    if (!isNaN(numValue) && numValue >= 0) {
      onChange(Math.round(numValue * 100) / 100);
    } else if (inputValue === "") {
      onChange(0);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <h2 className="text-sm font-medium text-gray-700 mb-3">Add a Tip</h2>
      <div className="flex flex-wrap gap-2">
        {TIP_PERCENTAGES.map((tip) => (
          <button
            key={tip.value}
            type="button"
            onClick={() => handlePercentageClick(tip.value)}
            disabled={disabled}
            className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
              !isCustom && selectedPercentage?.value === tip.value
                ? "border-red-600 bg-red-50 text-red-600"
                : "border-gray-200 hover:border-gray-300 text-gray-600"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {tip.label}
            {tip.value > 0 && (
              <span className="ml-1 text-xs text-gray-500">
                ({formatPrice(subtotal * tip.value)})
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={handleCustomClick}
          disabled={disabled}
          className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
            isCustom
              ? "border-red-600 bg-red-50 text-red-600"
              : "border-gray-200 hover:border-gray-300 text-gray-600"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          Custom
        </button>
      </div>
      {isCustom && (
        <div className="mt-3">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
              $
            </span>
            <input
              type="number"
              value={customValue}
              onChange={handleCustomChange}
              disabled={disabled}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full pl-8 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
        </div>
      )}
    </div>
  );
}
