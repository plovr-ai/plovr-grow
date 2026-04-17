"use client";

import { CreditCard, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SubscriptionInfo } from "@/services/subscription";
import { SubscriptionStatusBadge } from "./SubscriptionStatusBadge";
import { PricingCard } from "./PricingCard";

interface PlanInfo {
  code: string;
  name: string;
  monthlyPrice: number;
  currency: string;
  features: string[];
  recommended?: boolean;
}

interface ProductLineSectionProps {
  productLine: string;
  name: string;
  subscription: SubscriptionInfo | null;
  availablePlans: PlanInfo[];
  isLoading: boolean;
  onSubscribe: (productLine: string, planCode: string) => void;
  onChangePlan: (productLine: string, planCode: string) => void;
  onCancel: (productLine: string) => void;
  onResume: (productLine: string) => void;
  onManageBilling: () => void;
}

const PLAN_TIER: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

function formatDate(date: Date | null): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ProductLineSection({
  productLine,
  name,
  subscription,
  availablePlans,
  isLoading,
  onSubscribe,
  onChangePlan,
  onCancel,
  onResume,
  onManageBilling,
}: ProductLineSectionProps) {
  const isSubscribed =
    subscription &&
    subscription.status !== "canceled" &&
    subscription.status !== "incomplete";

  const getActionLabel = (planCode: string): string => {
    if (!isSubscribed) return "Start Free Trial";
    const currentTier = PLAN_TIER[subscription?.plan ?? "free"] ?? 0;
    const planTier = PLAN_TIER[planCode] ?? 0;
    if (planTier > currentTier) return "Upgrade";
    if (planTier < currentTier) return "Downgrade";
    return "Current Plan";
  };

  const isComingSoon = availablePlans.length === 0 && !subscription;

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-gray-900">{name}</h2>
        {isComingSoon && (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            Coming Soon
          </span>
        )}
      </div>

      {/* Trial Banner */}
      {subscription?.status === "trialing" &&
        subscription.trialDaysRemaining !== null && (
          <div className="rounded-md bg-blue-50 p-4">
            <div className="flex">
              <Clock className="h-5 w-5 text-blue-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Free Trial Active
                </h3>
                <p className="mt-1 text-sm text-blue-700">
                  You have {subscription.trialDaysRemaining} days remaining in
                  your free trial.
                  {subscription.trialEnd && (
                    <>
                      {" "}
                      Your trial ends on {formatDate(subscription.trialEnd)}.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

      {/* Past Due Banner */}
      {subscription?.status === "past_due" && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Payment Failed
              </h3>
              <p className="mt-1 text-sm text-red-700">
                Your last payment failed. Please update your payment method to
                continue using premium features.
                {subscription.gracePeriodEnd && (
                  <>
                    {" "}
                    You have until {formatDate(subscription.gracePeriodEnd)} to
                    update your payment.
                  </>
                )}
              </p>
              <div className="mt-3">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onManageBilling}
                  disabled={isLoading}
                >
                  Update Payment Method
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Banner */}
      {subscription?.cancelAtPeriodEnd &&
        subscription.status !== "canceled" && (
          <div className="rounded-md bg-yellow-50 p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Subscription Ending
                </h3>
                <p className="mt-1 text-sm text-yellow-700">
                  Your subscription is set to cancel at the end of your billing
                  period
                  {subscription.currentPeriodEnd && (
                    <> on {formatDate(subscription.currentPeriodEnd)}</>
                  )}
                  .
                </p>
                <div className="mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onResume(productLine)}
                    disabled={isLoading}
                  >
                    Resume Subscription
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Current Subscription Info */}
      {isSubscribed && (
        <div className="rounded-lg bg-white shadow">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <CreditCard className="h-8 w-8 text-gray-400" />
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {subscription.plan.charAt(0).toUpperCase() +
                      subscription.plan.slice(1)}{" "}
                    Plan
                  </h3>
                  <div className="mt-1 flex items-center gap-2">
                    <SubscriptionStatusBadge status={subscription.status} />
                    {subscription.cancelAtPeriodEnd && (
                      <span className="text-xs text-yellow-600">
                        (Cancels at period end)
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onManageBilling}
                  disabled={isLoading}
                >
                  Manage Billing
                </Button>
                {!subscription.cancelAtPeriodEnd &&
                  subscription.status !== "past_due" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onCancel(productLine)}
                      disabled={isLoading}
                    >
                      Cancel
                    </Button>
                  )}
              </div>
            </div>

            {(subscription.status === "active" ||
              subscription.status === "trialing") && (
              <div className="mt-6 border-t border-gray-200 pt-6">
                <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Current Period
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {formatDate(subscription.currentPeriodStart)} -{" "}
                      {formatDate(subscription.currentPeriodEnd)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Next Billing Date
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {subscription.cancelAtPeriodEnd
                        ? "No future billing"
                        : formatDate(subscription.currentPeriodEnd)}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pricing Cards */}
      {availablePlans.length > 0 && (
        <div>
          <h3 className="mb-4 text-base font-medium text-gray-700">
            {isSubscribed ? "Change Plan" : "Choose a Plan"}
          </h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {availablePlans.map((plan) => (
              <PricingCard
                key={plan.code}
                name={plan.name}
                monthlyPrice={plan.monthlyPrice}
                currency={plan.currency}
                features={plan.features}
                isCurrentPlan={subscription?.plan === plan.code}
                isRecommended={plan.recommended}
                actionLabel={getActionLabel(plan.code)}
                onAction={() =>
                  isSubscribed
                    ? onChangePlan(productLine, plan.code)
                    : onSubscribe(productLine, plan.code)
                }
                isLoading={isLoading}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
