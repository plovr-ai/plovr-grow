"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TextField,
  SelectField,
} from "@/components/dashboard/Form";
import {
  createTaxConfigAction,
  updateTaxConfigAction,
} from "@/app/(dashboard)/dashboard/(protected)/menu/tax/actions";
import type {
  TaxConfigWithRates,
  RoundingMethod,
} from "@/services/menu/tax-config.types";

interface TaxConfigFormProps {
  taxConfig: TaxConfigWithRates | null;
  merchants: Array<{ id: string; name: string }>;
  onClose: () => void;
}

const ROUNDING_METHODS: Array<{ value: RoundingMethod; label: string }> = [
  { value: "half_up", label: "Half Up (Standard)" },
  { value: "half_even", label: "Half Even (Banker's)" },
  { value: "always_round_up", label: "Always Round Up" },
  { value: "always_round_down", label: "Always Round Down" },
];

interface MerchantRateState {
  enabled: boolean;
  rate: string;
}

export function TaxConfigForm({
  taxConfig,
  merchants,
  onClose,
}: TaxConfigFormProps) {
  const isEditing = !!taxConfig;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState(taxConfig?.name ?? "");
  const [description, setDescription] = useState(taxConfig?.description ?? "");
  const [roundingMethod, setRoundingMethod] = useState<RoundingMethod>(
    taxConfig?.roundingMethod ?? "half_up"
  );

  // Merchant rates state
  const [merchantRates, setMerchantRates] = useState<Record<string, MerchantRateState>>(() => {
    const initial: Record<string, MerchantRateState> = {};
    merchants.forEach((merchant) => {
      const existingRate = taxConfig?.merchantRates.find(
        (r) => r.merchantId === merchant.id
      );
      initial[merchant.id] = {
        enabled: !!existingRate,
        rate: existingRate ? (existingRate.rate * 100).toFixed(2) : "",
      };
    });
    return initial;
  });

  const handleMerchantToggle = (merchantId: string) => {
    setMerchantRates((prev) => ({
      ...prev,
      [merchantId]: {
        ...prev[merchantId],
        enabled: !prev[merchantId].enabled,
      },
    }));
  };

  const handleRateChange = (merchantId: string, value: string) => {
    setMerchantRates((prev) => ({
      ...prev,
      [merchantId]: {
        ...prev[merchantId],
        rate: value,
      },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    // Build merchant rates array
    const rates: Array<{ merchantId: string; rate: number }> = [];
    for (const [merchantId, state] of Object.entries(merchantRates)) {
      if (state.enabled) {
        const rateValue = parseFloat(state.rate);
        if (isNaN(rateValue) || rateValue < 0 || rateValue > 100) {
          setError(`Invalid rate for ${merchants.find((m) => m.id === merchantId)?.name}`);
          return;
        }
        rates.push({
          merchantId,
          rate: rateValue / 100, // Convert percentage to decimal
        });
      }
    }

    startTransition(async () => {
      const result = isEditing
        ? await updateTaxConfigAction(taxConfig!.id, {
            name: name.trim(),
            description: description.trim() || undefined,
            roundingMethod,
            merchantRates: rates,
          })
        : await createTaxConfigAction({
            name: name.trim(),
            description: description.trim() || undefined,
            roundingMethod,
            merchantRates: rates,
          });

      if (result.success) {
        onClose();
      } else {
        setError(result.error || "An error occurred");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-lg font-semibold">
            {isEditing ? "Edit Tax Type" : "Add Tax Type"}
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

          <div className="space-y-4">
            {/* Name */}
            <TextField
              id="name"
              label="Tax Name"
              required
              value={name}
              onChange={setName}
              placeholder="e.g., Standard Tax, Alcohol Tax"
              disabled={isPending}
            />

            {/* Description */}
            <TextField
              id="description"
              label="Description"
              value={description}
              onChange={setDescription}
              placeholder="Optional description"
              disabled={isPending}
            />

            {/* Rounding Method */}
            <SelectField
              id="roundingMethod"
              label="Rounding Method"
              value={roundingMethod}
              onChange={(value) => setRoundingMethod(value as RoundingMethod)}
              options={ROUNDING_METHODS}
              disabled={isPending}
            />

            {/* Store Tax Rates */}
            <div className="border-t pt-4">
              <span className="mb-3 block text-sm font-medium">Store Tax Rates</span>
              <div className="space-y-3">
                {merchants.map((merchant) => {
                  const state = merchantRates[merchant.id];
                  return (
                    <div
                      key={merchant.id}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <input
                        type="checkbox"
                        id={`merchant-${merchant.id}`}
                        checked={state.enabled}
                        onChange={() => handleMerchantToggle(merchant.id)}
                        disabled={isPending}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <label
                        htmlFor={`merchant-${merchant.id}`}
                        className="flex-1 text-sm font-medium"
                      >
                        {merchant.name}
                      </label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={state.rate}
                          onChange={(e) => handleRateChange(merchant.id, e.target.value)}
                          disabled={isPending || !state.enabled}
                          placeholder="0.00"
                          className="w-24"
                        />
                        <span className="text-sm text-gray-500">%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : isEditing ? "Save Changes" : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
