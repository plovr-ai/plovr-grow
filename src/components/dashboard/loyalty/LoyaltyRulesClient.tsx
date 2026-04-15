"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField, RadioGroupField } from "@/components/dashboard/Form";
import { updateLoyaltyConfigAction } from "@/app/(dashboard)/dashboard/(protected)/loyalty/rules/actions";
import { getApiErrorMessage } from "@/lib/api";
import type { LoyaltyConfigData } from "@/services/loyalty/loyalty.types";

interface LoyaltyRulesClientProps {
  initialConfig: LoyaltyConfigData | null;
}

export function LoyaltyRulesClient({ initialConfig }: LoyaltyRulesClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [status, setStatus] = useState<"active" | "inactive">(
    (initialConfig?.status as "active" | "inactive") ?? "inactive"
  );
  const [pointsPerDollar, setPointsPerDollar] = useState(
    initialConfig?.pointsPerDollar?.toString() ?? "1"
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const points = parseFloat(pointsPerDollar);
    if (isNaN(points) || points < 0) {
      setError("Points per dollar must be a non-negative number");
      return;
    }

    startTransition(async () => {
      const result = await updateLoyaltyConfigAction({
        status,
        pointsPerDollar: points,
      });

      if (result.success) {
        setSuccess(true);
        router.refresh();
      } else {
        setError(getApiErrorMessage(result.error, "Failed to update loyalty configuration"));
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Loyalty Program Settings</h2>
        <p className="text-sm text-gray-500">
          Configure your loyalty program rules
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Program Status Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold">Program Status</h3>
          <RadioGroupField
            id="status"
            name="status"
            label=""
            value={status}
            onChange={(value) => setStatus(value as "active" | "inactive")}
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
            layout="vertical"
          />
          <p className="mt-2 text-sm text-gray-500">
            {status === "active"
              ? "Customers can earn and redeem points"
              : "Loyalty program is disabled"}
          </p>
        </div>

        {/* Points Configuration Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold">Points Configuration</h3>
          <TextField
            id="pointsPerDollar"
            label="Points per Dollar"
            value={pointsPerDollar}
            onChange={setPointsPerDollar}
            type="number"
            placeholder="1"
          />
          <p className="mt-2 text-sm text-gray-500">
            How many points customers earn for each $1 spent
          </p>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg bg-green-50 p-4 text-sm text-green-600">
            Loyalty configuration updated successfully
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
