"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreditCard, CheckCircle, AlertTriangle, XCircle, Clock } from "lucide-react";
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
}

interface SubscriptionClientProps {
  subscription: SubscriptionInfo | null;
}

const PLAN_TIER: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

export function SubscriptionClient({ subscription }: SubscriptionClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanInfo[]>([]);

  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  useEffect(() => {
    fetch("/api/dashboard/subscription/plans")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setPlans(data.data);
        }
      })
      .catch(() => {
        // Plans will remain empty; cards won't render
      });
  }, []);

  const isSubscribed =
    subscription &&
    subscription.status !== "canceled" &&
    subscription.status !== "incomplete";

  const handleSubscribe = async (planCode: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/dashboard/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      window.location.href = data.data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsLoading(false);
    }
  };

  const handleChangePlan = async (planCode: string) => {
    const currentTier = PLAN_TIER[subscription?.plan ?? "free"] ?? 0;
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
      const response = await fetch("/api/dashboard/subscription/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to change plan");
      }

      router.refresh();
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
        throw new Error(data.error || "Failed to open billing portal");
      }

      window.location.href = data.data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
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
      const response = await fetch("/api/dashboard/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancelImmediately: false }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to cancel subscription");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/dashboard/subscription/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to resume subscription");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getActionLabel = (planCode: string): string => {
    if (!isSubscribed) return "Start Free Trial";
    const currentTier = PLAN_TIER[subscription?.plan ?? "free"] ?? 0;
    const planTier = PLAN_TIER[planCode] ?? 0;
    if (planTier > currentTier) return "Upgrade";
    if (planTier < currentTier) return "Downgrade";
    return "Current Plan";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Subscription</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your subscription and billing
        </p>
      </div>

      {/* Success/Canceled Messages */}
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
                  onClick={handleManageBilling}
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
                    onClick={handleResume}
                    disabled={isLoading}
                  >
                    Resume Subscription
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Current Subscription Info (when subscribed) */}
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
                  onClick={handleManageBilling}
                  disabled={isLoading}
                >
                  Manage Billing
                </Button>
                {!subscription.cancelAtPeriodEnd &&
                  subscription.status !== "past_due" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancel}
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
      {plans.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            {isSubscribed ? "Change Plan" : "Choose a Plan"}
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <PricingCard
                key={plan.code}
                name={plan.name}
                monthlyPrice={plan.monthlyPrice}
                currency={plan.currency}
                features={plan.features}
                isCurrentPlan={subscription?.plan === plan.code}
                isRecommended={plan.code === "pro"}
                actionLabel={getActionLabel(plan.code)}
                onAction={() =>
                  isSubscribed
                    ? handleChangePlan(plan.code)
                    : handleSubscribe(plan.code)
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
