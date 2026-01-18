"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Globe } from "lucide-react";

interface WebsiteStepProps {
  companyId: string;
}

export function WebsiteStep({ companyId }: WebsiteStepProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Globe className="mx-auto h-16 w-16 text-blue-500" />
            <h3 className="mt-4 text-lg font-semibold">
              Website Configuration
            </h3>
            <p className="mt-2 text-gray-600">
              This step will guide you through setting up your restaurant
              website.
            </p>
            <p className="mt-1 text-sm text-gray-400">Company ID: {companyId}</p>
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-gray-500">
        TODO: Implement website builder interface
      </p>
    </div>
  );
}
