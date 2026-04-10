export interface CreatePaymentIntentRequest {
  tenantId: string;
  merchantId?: string;
  amount: number;
  currency?: string;
  orderId?: string;
}

export interface CreatePaymentIntentResponse {
  paymentIntentId: string;
  clientSecret: string;
  stripeAccountId: string;
}

export interface PaymentSucceededData {
  paymentIntentId: string;
  status: string;
  paymentMethodType?: string;
  cardBrand?: string;
  cardLast4?: string;
}

export interface PaymentFailedData {
  paymentIntentId: string;
  failureCode?: string;
  failureMessage?: string;
}

export interface CreatePaymentRecordInput {
  tenantId: string;
  orderId: string;
  stripePaymentIntentId: string;
  stripeAccountId?: string;
  stripeCustomerId?: string | null;
  amount: number;
  currency: string;
}

export interface VerifyPaymentResult {
  success: boolean;
  paymentIntentId: string;
  status: string;
  amount: number;
  cardBrand?: string;
  cardLast4?: string;
  error?: string;
}
