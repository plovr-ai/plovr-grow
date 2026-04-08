"use client";

import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PricingCardProps {
  name: string;
  monthlyPrice: number;
  currency: string;
  features: string[];
  isCurrentPlan: boolean;
  isRecommended?: boolean;
  actionLabel: string;
  onAction: () => void;
  isLoading: boolean;
}

export function PricingCard({
  name,
  monthlyPrice,
  currency,
  features,
  isCurrentPlan,
  isRecommended,
  actionLabel,
  onAction,
  isLoading,
}: PricingCardProps) {
  return (
    <div
      className={`relative rounded-lg border-2 bg-white p-6 shadow-sm ${
        isCurrentPlan
          ? "border-theme-primary"
          : isRecommended
            ? "border-theme-primary-hover"
            : "border-gray-200"
      }`}
    >
      {isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-theme-primary px-3 py-1 text-xs font-medium text-theme-primary-foreground">
            Current Plan
          </span>
        </div>
      )}
      {!isCurrentPlan && isRecommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-theme-primary-hover px-3 py-1 text-xs font-medium text-theme-primary-foreground">
            Recommended
          </span>
        </div>
      )}

      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
        <div className="mt-4">
          <span className="text-4xl font-bold text-gray-900">
            ${monthlyPrice}
          </span>
          <span className="text-sm text-gray-500">
            /{currency === "USD" ? "mo" : "mo"}
          </span>
        </div>
      </div>

      <ul className="mt-6 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start">
            <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
            <span className="ml-2 text-sm text-gray-700">{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <Button
          className="w-full"
          variant={isCurrentPlan ? "outline" : "default"}
          onClick={onAction}
          disabled={isCurrentPlan || isLoading}
        >
          {isCurrentPlan ? "Current Plan" : isLoading ? "Loading..." : actionLabel}
        </Button>
      </div>
    </div>
  );
}
