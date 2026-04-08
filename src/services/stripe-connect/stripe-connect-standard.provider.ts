import { stripeService } from "@/services/stripe";
import type {
  PaymentProvider,
  CreateProviderPaymentIntentInput,
  ProviderPaymentIntentResult,
  ProviderRetrievedPaymentIntent,
} from "./stripe-connect.types";

export class StripeConnectStandardProvider implements PaymentProvider {
  readonly type = "stripe_connect_standard" as const

  async createPaymentIntent(input: CreateProviderPaymentIntentInput): Promise<ProviderPaymentIntentResult> {
    const result = await stripeService.createPaymentIntent({
      amount: input.amount,
      currency: input.currency,
      stripeAccount: input.stripeAccountId,
      metadata: input.metadata,
    })
    return {
      paymentIntentId: result.id,
      clientSecret: result.clientSecret,
      stripeAccountId: input.stripeAccountId,
    }
  }

  async retrievePaymentIntent(paymentIntentId: string, stripeAccountId: string): Promise<ProviderRetrievedPaymentIntent> {
    const result = await stripeService.retrievePaymentIntent(paymentIntentId, stripeAccountId)
    return result as ProviderRetrievedPaymentIntent
  }

  verifyWebhookSignature(payload: string, signature: string) {
    return stripeService.verifyConnectWebhookSignature(payload, signature)
  }
}
