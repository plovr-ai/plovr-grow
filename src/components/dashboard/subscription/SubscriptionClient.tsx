"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api";
import type { ProductLineSubscriptionInfo } from "@/services/subscription/subscription.types";
import { ProductLineSection } from "./ProductLineSection";

const PLAN_TIER: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

export function SubscriptionClient() {
  const searchParams = useSearchParams();
  const [productLines, setProductLines] = useState<ProductLineSubscriptionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  const fetchOverview = () => {
    fetch("/api/dashboard/subscription")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setProductLines(data.data.productLines);
        }
      })
      .catch(() => {
        // Data will remain empty
      });
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const handleSubscribe = async (productLine: string, planCode: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/dashboard/subscription/${productLine}/checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planCode }),
        }
      );

      const data = await response.json();
      if (!data.success) {
        throw new Error(
          getApiErrorMessage(data.error, "Failed to create checkout session")
        );
      }

      window.location.href = data.data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsLoading(false);
    }
  };

  const handleChangePlan = async (productLine: string, planCode: string) => {
    const pl = productLines.find((p) => p.productLine === productLine);
    const currentPlan = pl?.subscription?.plan ?? "free";
    const currentTier = PLAN_TIER[currentPlan] ?? 0;
    const newTier = PLAN_TIER[planCode] ?? 0;
    const action = newTier > currentTier ? "upgrade" : "downgrade";

    if (
      !confirm(
        `Are you sure you want to ${action} to the ${planCode.charAt(0).toUpperCase() + planCode.slice(1)} plan? Your billing will be adjusted with proration.`
      )
    ) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/dashboard/subscription/${productLine}/change-plan`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planCode }),
        }
      );

      const data = await response.json();
      if (!data.success) {
        throw new Error(getApiErrorMessage(data.error, "Failed to change plan"));
      }

      fetchOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async (productLine: string) => {
    if (
      !confirm(
        "Are you sure you want to cancel your subscription? You will still have access until the end of your billing period."
      )
    ) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/dashboard/subscription/${productLine}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cancelImmediately: false }),
        }
      );

      const data = await response.json();
      if (!data.success) {
        throw new Error(
          getApiErrorMessage(data.error, "Failed to cancel subscription")
        );
      }

      fetchOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async (productLine: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/dashboard/subscription/${productLine}/resume`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      const data = await response.json();
      if (!data.success) {
        throw new Error(
          getApiErrorMessage(data.error, "Failed to resume subscription")
        );
      }

      fetchOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/dashboard/subscription/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(
          getApiErrorMessage(data.error, "Failed to open billing portal")
        );
      }

      window.location.href = data.data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Subscription</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your subscriptions and billing
        </p>
      </div>

      {/* Success/Canceled/Error Messages */}
      {success && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                Subscription activated successfully!
              </p>
            </div>
          </div>
        </div>
      )}

      {canceled && (
        <div className="rounded-md bg-yellow-50 p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-yellow-800">
                Checkout was canceled. You can try again anytime.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <XCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Product Line Sections */}
      {productLines.map((pl) => (
        <ProductLineSection
          key={pl.productLine}
          productLine={pl.productLine}
          name={pl.name}
          subscription={pl.subscription}
          availablePlans={pl.availablePlans}
          isLoading={isLoading}
          onSubscribe={handleSubscribe}
          onChangePlan={handleChangePlan}
          onCancel={handleCancel}
          onResume={handleResume}
          onManageBilling={handleManageBilling}
        />
      ))}
    </div>
  );
}
