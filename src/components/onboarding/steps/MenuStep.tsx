"use client";

import { Card, CardContent } from "@/components/ui/card";
import { UtensilsCrossed } from "lucide-react";

interface MenuStepProps {
  companyId: string;
}

export function MenuStep({ companyId }: MenuStepProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <UtensilsCrossed className="mx-auto h-16 w-16 text-blue-500" />
            <h3 className="mt-4 text-lg font-semibold">Menu Configuration</h3>
            <p className="mt-2 text-gray-600">
              This step will guide you through creating your menu categories and
              items.
            </p>
            <p className="mt-1 text-sm text-gray-400">Company ID: {companyId}</p>
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-gray-500">
        TODO: Implement menu builder interface
      </p>
    </div>
  );
}
