export interface CreatePaymentLinkInput {
  amount: number;
  currency: string;
  description: string;
  metadata: Record<string, string>;
}

export interface PaymentLinkResult {
  id: string;
  url: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      metadata?: Record<string, string>;
      amount_total?: number;
      currency?: string;
      payment_status?: string;
      // PaymentIntent specific fields
      status?: string;
      amount?: number;
      payment_method?: string;
      payment_method_types?: string[];
      last_payment_error?: {
        code?: string;
        message?: string;
      };
      charges?: {
        data: Array<{
          payment_method_details?: {
            card?: {
              brand?: string;
              last4?: string;
              exp_month?: number;
              exp_year?: number;
            };
            type?: string;
          };
        }>;
      };
    };
  };
}

// PaymentIntent types
export interface CreatePaymentIntentInput {
  amount: number;
  currency: string;
  customerId?: string;
  saveCard?: boolean;
  metadata?: Record<string, string>;
}

export interface PaymentIntentResult {
  id: string;
  clientSecret: string;
  status: string;
}

export interface RetrievedPaymentIntent {
  id: string;
  status: string;
  amount: number;
  currency: string;
  metadata?: Record<string, string>;
  paymentMethodType?: string;
  cardBrand?: string;
  cardLast4?: string;
}

// Customer types
export interface CreateCustomerInput {
  email: string;
  name: string;
  metadata?: Record<string, string>;
}

export interface PaymentMethodInfo {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

// ==================== Subscription Types ====================

export interface CreateSubscriptionCheckoutInput {
  customerId: string;
  priceId: string;
  tenantId: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
}

export interface SubscriptionCheckoutResult {
  sessionId: string;
  url: string;
}

export interface CreateBillingPortalInput {
  customerId: string;
  returnUrl: string;
}

export interface BillingPortalResult {
  url: string;
}

export interface StripeSubscriptionInfo {
  id: string;
  status: string;
  customerId: string;
  priceId: string | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart: Date | null;
  trialEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
}
