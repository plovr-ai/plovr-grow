"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/dashboard/Form";
import { updateTenantSettingsAction } from "@/app/(dashboard)/dashboard/(protected)/tenant/actions";
import { getApiErrorMessage } from "@/lib/api";
import { CURRENCY_OPTIONS, LOCALE_OPTIONS } from "@/constants/i18n";

interface TenantSettingsFormProps {
  currency: string;
  locale: string;
  onClose: () => void;
}

export function TenantSettingsForm({
  currency: initialCurrency,
  locale: initialLocale,
  onClose,
}: TenantSettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [currency, setCurrency] = useState(initialCurrency);
  const [locale, setLocale] = useState(initialLocale);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await updateTenantSettingsAction({
        currency,
        locale,
      });

      if (result.success) {
        router.refresh();
        onClose();
      } else {
        setError(getApiErrorMessage(result.error, "Failed to update settings"));
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Edit Regional Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Currency */}
          <SelectField
            id="currency"
            label="Currency"
            value={currency}
            onChange={setCurrency}
            options={CURRENCY_OPTIONS}
            disabled={isPending}
            helperText="Currency used for menu prices and orders"
          />

          {/* Locale */}
          <SelectField
            id="locale"
            label="Locale"
            value={locale}
            onChange={setLocale}
            options={LOCALE_OPTIONS}
            disabled={isPending}
            helperText="Determines number and date formatting"
          />

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
