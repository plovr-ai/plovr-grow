"use client";

import type { OrderType } from "@/lib/validations/checkout";

interface OrderTypeSelectorProps {
  value: OrderType;
  onChange: (type: OrderType) => void;
  disabled?: boolean;
}

const ORDER_TYPE_OPTIONS: { value: OrderType; label: string; icon: string }[] = [
  { value: "pickup", label: "Pickup", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { value: "delivery", label: "Delivery", icon: "M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" },
  { value: "dine_in", label: "Dine In", icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" },
];

export function OrderTypeSelector({
  value,
  onChange,
  disabled = false,
}: OrderTypeSelectorProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <h2 className="text-sm font-medium text-gray-700 mb-3">Order Type</h2>
      <div className="grid grid-cols-3 gap-2">
        {ORDER_TYPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={disabled}
            className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
              value === option.value
                ? "border-red-600 bg-red-50 text-red-600"
                : "border-gray-200 hover:border-gray-300 text-gray-600"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d={option.icon}
              />
            </svg>
            <span className="text-sm font-medium">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
