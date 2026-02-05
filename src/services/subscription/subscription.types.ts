// ==================== Subscription Status ====================

export const SUBSCRIPTION_STATUSES = [
  "incomplete",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

// ==================== Subscription Plan ====================

export const SUBSCRIPTION_PLANS = ["free", "standard"] as const;

export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

// ==================== Subscription Info ====================

export interface SubscriptionInfo {
  id: string;
  tenantId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  status: SubscriptionStatus;
  plan: SubscriptionPlan;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  trialStart: Date | null;
  trialEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  gracePeriodEnd: Date | null;
  // Computed fields
  isInGracePeriod: boolean;
  canAccessPremiumFeatures: boolean;
  trialDaysRemaining: number | null;
}

// ==================== API Request/Response Types ====================

export interface CreateCheckoutSessionRequest {
  successUrl?: string;
  cancelUrl?: string;
}

export interface CreateCheckoutSessionResponse {
  url: string;
  sessionId: string;
}

export interface CreateBillingPortalRequest {
  returnUrl?: string;
}

export interface CreateBillingPortalResponse {
  url: string;
}

export interface CancelSubscriptionRequest {
  cancelImmediately?: boolean;
}

export interface SubscriptionResponse {
  subscription: SubscriptionInfo | null;
}

// ==================== Webhook Event Data ====================

export interface StripeSubscriptionData {
  id: string;
  customer: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  trial_start: number | null;
  trial_end: number | null;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  items: {
    data: Array<{
      price: {
        id: string;
      };
    }>;
  };
  metadata: {
    tenantId?: string;
  };
}

export interface StripeInvoiceData {
  id: string;
  customer: string;
  subscription: string | null;
  status: string;
  amount_paid: number;
  amount_due: number;
  currency: string;
}

export interface StripeCheckoutSessionData {
  id: string;
  customer: string;
  subscription: string | null;
  mode: "subscription" | "payment" | "setup";
  metadata: {
    tenantId?: string;
  };
}

// ==================== Service Method Types ====================

export interface CheckoutSessionOptions {
  successUrl: string;
  cancelUrl: string;
}

// ==================== Dashboard Context Subscription ====================

export interface DashboardSubscriptionInfo {
  status: SubscriptionStatus;
  plan: SubscriptionPlan;
  canAccessPremiumFeatures: boolean;
  isTrialing: boolean;
  trialDaysRemaining: number | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
}
