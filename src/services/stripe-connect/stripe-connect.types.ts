// --- PaymentProvider Interface ---

export interface CreateProviderPaymentIntentInput {
  amount: number
  currency: string
  stripeAccountId: string
  metadata?: Record<string, string>
}

export interface ProviderPaymentIntentResult {
  paymentIntentId: string
  clientSecret: string
  stripeAccountId: string
}

export interface ProviderRetrievedPaymentIntent {
  id: string
  status: string
  amount: number
  currency: string
  paymentMethodType?: string
  cardBrand?: string
  cardLast4?: string
}

export interface PaymentProvider {
  readonly type: "stripe_connect_standard" | "stripe_connect_express"

  createPaymentIntent(input: CreateProviderPaymentIntentInput): Promise<ProviderPaymentIntentResult>
  retrievePaymentIntent(paymentIntentId: string, stripeAccountId: string): Promise<ProviderRetrievedPaymentIntent>
  verifyWebhookSignature(payload: string, signature: string): unknown
}

// --- Connect Account Types ---


export interface ConnectAccountStatus {
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
}

export interface OAuthCallbackResult {
  stripeAccountId: string
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
}
