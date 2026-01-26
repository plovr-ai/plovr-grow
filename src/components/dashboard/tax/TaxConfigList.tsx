"use client";

import { useState, useTransition } from "react";
import { Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteTaxConfigAction } from "@/app/(dashboard)/dashboard/(protected)/menu/tax/actions";
import type { TaxConfigWithRates } from "@/services/menu/tax-config.types";

interface TaxConfigListProps {
  taxConfigs: TaxConfigWithRates[];
  merchants: Array<{ id: string; name: string }>;
  onEdit: (config: TaxConfigWithRates) => void;
}

const ROUNDING_METHOD_LABELS: Record<string, string> = {
  half_up: "Half Up",
  half_even: "Half Even",
  always_round_up: "Round Up",
  always_round_down: "Round Down",
};

export function TaxConfigList({ taxConfigs, merchants, onEdit }: TaxConfigListProps) {
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [taxConfigToDelete, setTaxConfigToDelete] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    setTaxConfigToDelete(id);
    setShowConfirmDialog(true);
  };

  const handleConfirmDelete = () => {
    if (!taxConfigToDelete) return;

    setShowConfirmDialog(false);
    setDeletingId(taxConfigToDelete);
    startTransition(async () => {
      const result = await deleteTaxConfigAction(taxConfigToDelete);
      if (!result.success) {
        alert(result.error || "Failed to delete tax type");
      }
      setDeletingId(null);
      setTaxConfigToDelete(null);
    });
  };

  if (taxConfigs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-gray-500">No tax table configured yet.</p>
          <p className="text-sm text-gray-400">
            Click &quot;Add Tax Type&quot; to create your first tax configuration.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Tax Table</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-gray-500">
                  <th className="pb-3 pr-4 font-medium">Name</th>
                  <th className="pb-3 pr-4 font-medium">Rounding</th>
                  <th className="pb-3 pr-4 font-medium">Store Rates</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {taxConfigs.map((config) => (
                  <tr key={config.id} className="border-b last:border-0">
                    <td className="py-4 pr-4">
                      <div className="font-medium">{config.name}</div>
                      {config.description && (
                        <div className="text-sm text-gray-500">{config.description}</div>
                      )}
                    </td>
                    <td className="py-4 pr-4 text-sm">
                      {ROUNDING_METHOD_LABELS[config.roundingMethod] || config.roundingMethod}
                    </td>
                    <td className="py-4 pr-4">
                      <StoreRatesSummary
                        rates={config.merchantRates}
                        totalMerchants={merchants.length}
                      />
                    </td>
                    <td className="py-4">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onEdit(config)}
                          disabled={isPending}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(config.id)}
                          disabled={isPending && deletingId === config.id}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        isOpen={showConfirmDialog}
        onClose={() => {
          setShowConfirmDialog(false);
          setTaxConfigToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Tax Type"
        message="Are you sure you want to delete this tax type?"
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
}

function StoreRatesSummary({
  rates,
  totalMerchants,
}: {
  rates: Array<{ merchantId: string; merchantName: string; rate: number }>;
  totalMerchants: number;
}) {
  if (rates.length === 0) {
    return <span className="text-sm text-gray-400">No rates configured</span>;
  }

  return (
    <div className="space-y-1">
      <span className="text-sm font-medium">
        {rates.length}/{totalMerchants} stores
      </span>
      <div className="flex flex-wrap gap-1">
        {rates.slice(0, 3).map((rate) => (
          <span
            key={rate.merchantId}
            className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs"
            title={rate.merchantName}
          >
            {(rate.rate * 100).toFixed(2)}%
          </span>
        ))}
        {rates.length > 3 && (
          <span className="text-xs text-gray-400">+{rates.length - 3} more</span>
        )}
      </div>
    </div>
  );
}
