"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import type { FeeConfig, Fee, FeeType } from "@/types";

interface FeeConfigEditorProps {
  value: FeeConfig;
  onChange: (value: FeeConfig) => void;
  disabled?: boolean;
}

export function FeeConfigEditor({
  value,
  onChange,
  disabled,
}: FeeConfigEditorProps) {
  const [newFee, setNewFee] = useState({
    name: "",
    displayName: "",
    type: "fixed" as FeeType,
    value: "",
  });

  const generateId = () => `fee-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const handleAddFee = () => {
    if (!newFee.name.trim() || !newFee.value) return;

    const feeValue = parseFloat(newFee.value);
    if (isNaN(feeValue) || feeValue <= 0) return;

    // For percentage, convert if user entered whole number
    const finalValue =
      newFee.type === "percentage" && feeValue > 1
        ? feeValue / 100
        : feeValue;

    const fee: Fee = {
      id: generateId(),
      name: newFee.name.trim(),
      displayName: newFee.displayName.trim() || undefined,
      type: newFee.type,
      value: finalValue,
    };

    onChange({
      ...value,
      fees: [...value.fees, fee],
    });

    setNewFee({
      name: "",
      displayName: "",
      type: "fixed",
      value: "",
    });
  };

  const handleRemoveFee = (id: string) => {
    onChange({
      ...value,
      fees: value.fees.filter((f) => f.id !== id),
    });
  };

  const handleUpdateFee = (id: string, updates: Partial<Fee>) => {
    onChange({
      ...value,
      fees: value.fees.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    });
  };

  const formatFeeValue = (fee: Fee) => {
    if (fee.type === "percentage") {
      return `${(fee.value * 100).toFixed(1)}%`;
    }
    return `$${fee.value.toFixed(2)}`;
  };

  return (
    <div className="space-y-4">
      {/* Existing Fees */}
      {value.fees.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1fr_100px_100px_40px] gap-2 text-sm font-medium text-gray-500 px-1">
            <span>Name</span>
            <span>Display Name</span>
            <span>Type</span>
            <span>Value</span>
            <span></span>
          </div>
          {value.fees.map((fee) => (
            <div
              key={fee.id}
              className="grid grid-cols-[1fr_1fr_100px_100px_40px] gap-2 items-center"
            >
              <Input
                value={fee.name}
                onChange={(e) =>
                  handleUpdateFee(fee.id, { name: e.target.value })
                }
                disabled={disabled}
                placeholder="Fee name"
              />
              <Input
                value={fee.displayName || ""}
                onChange={(e) =>
                  handleUpdateFee(fee.id, { displayName: e.target.value })
                }
                disabled={disabled}
                placeholder="Customer-facing name"
              />
              <Select
                value={fee.type}
                onChange={(e) =>
                  handleUpdateFee(fee.id, { type: e.target.value as FeeType })
                }
                disabled={disabled}
              >
                <option value="fixed">Fixed</option>
                <option value="percentage">Percent</option>
              </Select>
              <div className="text-sm font-medium text-gray-700">
                {formatFeeValue(fee)}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveFee(fee.id)}
                disabled={disabled}
                className="p-2"
              >
                <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add New Fee */}
      <div className="border-t pt-4">
        <p className="text-sm font-medium text-gray-700 mb-3">Add New Fee</p>
        <div className="grid grid-cols-[1fr_1fr_100px_100px_80px] gap-2 items-center">
          <Input
            value={newFee.name}
            onChange={(e) => setNewFee({ ...newFee, name: e.target.value })}
            disabled={disabled}
            placeholder="e.g., Service Fee"
          />
          <Input
            value={newFee.displayName}
            onChange={(e) =>
              setNewFee({ ...newFee, displayName: e.target.value })
            }
            disabled={disabled}
            placeholder="Optional display name"
          />
          <Select
            value={newFee.type}
            onChange={(e) =>
              setNewFee({ ...newFee, type: e.target.value as FeeType })
            }
            disabled={disabled}
          >
            <option value="fixed">Fixed</option>
            <option value="percentage">Percent</option>
          </Select>
          <Input
            type="number"
            value={newFee.value}
            onChange={(e) => setNewFee({ ...newFee, value: e.target.value })}
            disabled={disabled}
            placeholder={newFee.type === "percentage" ? "5 for 5%" : "2.00"}
            step={newFee.type === "percentage" ? "0.1" : "0.01"}
            min="0"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddFee}
            disabled={disabled || !newFee.name || !newFee.value}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {value.fees.length === 0 && (
        <p className="text-sm text-gray-500 italic">
          No fees configured. Add fees like service charges or delivery fees.
        </p>
      )}
    </div>
  );
}
