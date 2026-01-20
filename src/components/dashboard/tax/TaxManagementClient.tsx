"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaxConfigList } from "./TaxConfigList";
import { TaxConfigForm } from "./TaxConfigForm";
import type { TaxConfigWithRates } from "@/services/menu/tax-config.types";

interface TaxManagementClientProps {
  taxConfigs: TaxConfigWithRates[];
  merchants: Array<{ id: string; name: string }>;
}

export function TaxManagementClient({
  taxConfigs,
  merchants,
}: TaxManagementClientProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<TaxConfigWithRates | null>(null);

  const handleAdd = () => {
    setEditingConfig(null);
    setIsFormOpen(true);
  };

  const handleEdit = (config: TaxConfigWithRates) => {
    setEditingConfig(config);
    setIsFormOpen(true);
  };

  const handleClose = () => {
    setIsFormOpen(false);
    setEditingConfig(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Tax Configuration</h2>
          <p className="text-sm text-gray-500">
            Manage tax table and rates for your stores
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Tax Type
        </Button>
      </div>

      <TaxConfigList
        taxConfigs={taxConfigs}
        merchants={merchants}
        onEdit={handleEdit}
      />

      {isFormOpen && (
        <TaxConfigForm
          taxConfig={editingConfig}
          merchants={merchants}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
