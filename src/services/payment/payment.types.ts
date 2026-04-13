import type { PaymentProvider } from "@/repositories/payment.repository";

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
  provider: PaymentProvider;
  providerPaymentId: string;
  status: string;
  paymentMethodType?: string;
  cardBrand?: string;
  cardLast4?: string;
}

export interface PaymentFailedData {
  provider: PaymentProvider;
  providerPaymentId: string;
  failureCode?: string;
  failureMessage?: string;
}

export interface CreatePaymentRecordInput {
  tenantId: string;
  orderId: string;
  provider: PaymentProvider;
  providerPaymentId?: string | null;
  stripeAccountId?: string;
  stripeCustomerId?: string | null;
  amount: number;
  currency: string;
  status?: string;
  paidAt?: Date | null;
  paymentMethod?: string | null;
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
