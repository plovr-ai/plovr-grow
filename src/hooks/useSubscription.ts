"use client";

import { useDashboard } from "@/contexts/DashboardContext";
import type { SubscriptionStatus, SubscriptionPlan } from "@/services/subscription/subscription.types";

export interface UseSubscriptionResult {
  /** Whether the subscription allows access to premium features (active, trialing, or in grace period) */
  isActive: boolean;
  /** Current subscription status */
  status: SubscriptionStatus;
  /** Current subscription plan */
  plan: SubscriptionPlan;
  /** Whether currently in trial period */
  isTrialing: boolean;
  /** Days remaining in trial (null if not trialing) */
  trialDaysRemaining: number | null;
  /** Whether subscription is set to cancel at period end */
  cancelAtPeriodEnd: boolean;
  /** End date of current billing period */
  currentPeriodEnd: Date | null;
  /** Whether there is any subscription record */
  hasSubscription: boolean;
}

/**
 * Hook to access subscription information from Dashboard context
 */
export function useSubscription(): UseSubscriptionResult {
  const { subscription } = useDashboard();

  if (!subscription) {
    return {
      isActive: false,
      status: "incomplete",
      plan: "free",
      isTrialing: false,
      trialDaysRemaining: null,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      hasSubscription: false,
    };
  }

  return {
    isActive: subscription.canAccessPremiumFeatures,
    status: subscription.status,
    plan: subscription.plan,
    isTrialing: subscription.isTrialing,
    trialDaysRemaining: subscription.trialDaysRemaining,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    currentPeriodEnd: subscription.currentPeriodEnd,
    hasSubscription: true,
  };
}

