import Stripe from "stripe";
import type {
  CreatePaymentLinkInput,
  PaymentLinkResult,
  WebhookEvent,
  CreatePaymentIntentInput,
  PaymentIntentResult,
  RetrievedPaymentIntent,
  CreateCustomerInput,
  CreateSubscriptionCheckoutInput,
  SubscriptionCheckoutResult,
  CreateBillingPortalInput,
  BillingPortalResult,
  StripeSubscriptionInfo,
  StripeOAuthTokenResponse,
  StripeAccountInfo,
  UpdateSubscriptionPriceInput,
} from "./stripe.types";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_CONNECT_CLIENT_ID = process.env.STRIPE_CONNECT_CLIENT_ID;
const STRIPE_CONNECT_WEBHOOK_SECRET = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

// Initialize Stripe client only if key is available
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

function isMockMode(): boolean {
  return !stripe;
}

/**
 * Create a Stripe Payment Link for invoice payment
 */
async function createPaymentLink(input: CreatePaymentLinkInput): Promise<PaymentLinkResult> {
  if (isMockMode()) {
    // Mock mode: return a fake payment link
    const mockId = `mock_pl_${crypto.randomUUID().slice(0, 8)}`;
    console.log("[Stripe Mock] Creating payment link:", {
      amount: input.amount,
      currency: input.currency,
      description: input.description,
      metadata: input.metadata,
    });
    return {
      id: mockId,
      url: `https://mock-stripe.com/pay/${mockId}`,
    };
  }

  // Create a product for this invoice
  const product = await stripe!.products.create({
    name: input.description,
    metadata: input.metadata,
  });

  // Create a price for the product
  const price = await stripe!.prices.create({
    product: product.id,
    unit_amount: Math.round(input.amount * 100), // Stripe uses cents
    currency: input.currency.toLowerCase(),
  });

  // Create the payment link
  const paymentLink = await stripe!.paymentLinks.create({
    line_items: [
      {
        price: price.id,
        quantity: 1,
      },
    ],
    metadata: input.metadata,
    after_completion: {
      type: "redirect",
      redirect: {
        url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/payment/success?invoice=${input.metadata.invoiceNumber}`,
      },
    },
  });

  return {
    id: paymentLink.id,
    url: paymentLink.url,
  };
}

/**
 * Verify Stripe webhook signature
 */
function verifyWebhookSignature(payload: string, signature: string): WebhookEvent | null {
  if (isMockMode() || !STRIPE_WEBHOOK_SECRET) {
    console.log("[Stripe Mock] Skipping webhook verification");
    try {
      return JSON.parse(payload) as WebhookEvent;
    } catch {
      return null;
    }
  }

  try {
    const event = stripe!.webhooks.constructEvent(
      payload,
      signature,
      STRIPE_WEBHOOK_SECRET
    );
    return event as unknown as WebhookEvent;
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return null;
  }
}

/**
 * Check if Stripe is configured
 */
function isConfigured(): boolean {
  return !isMockMode();
}

// ==================== PaymentIntent Methods ====================

/**
 * Create a PaymentIntent for order checkout
 */
async function createPaymentIntent(
  input: CreatePaymentIntentInput
): Promise<PaymentIntentResult> {
  if (isMockMode()) {
    const mockId = `mock_pi_${crypto.randomUUID().slice(0, 8)}`;
    console.log("[Stripe Mock] Creating PaymentIntent:", {
      amount: input.amount,
      currency: input.currency,
      customerId: input.customerId,
      saveCard: input.saveCard,
      metadata: input.metadata,
    });
    return {
      id: mockId,
      clientSecret: `${mockId}_secret_${crypto.randomUUID().slice(0, 8)}`,
      status: "requires_payment_method",
    };
  }

  const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
    amount: Math.round(input.amount * 100), // Convert to cents
    currency: input.currency.toLowerCase(),
    payment_method_types: ["card"],
    metadata: input.metadata,
  };

  // Attach customer if provided (for saved cards)
  if (input.customerId) {
    paymentIntentParams.customer = input.customerId;
  }

  // Set up for saving card if requested
  if (input.saveCard && input.customerId) {
    paymentIntentParams.setup_future_usage = "on_session";
  }

  const options: Stripe.RequestOptions | undefined = input.stripeAccount
    ? { stripeAccount: input.stripeAccount }
    : undefined;

  const paymentIntent = await stripe!.paymentIntents.create(
    paymentIntentParams,
    options
  );

  return {
    id: paymentIntent.id,
    clientSecret: paymentIntent.client_secret!,
    status: paymentIntent.status,
  };
}

/**
 * Retrieve a PaymentIntent by ID
 */
async function retrievePaymentIntent(
  paymentIntentId: string,
  stripeAccount?: string
): Promise<RetrievedPaymentIntent | null> {
  if (isMockMode()) {
    console.log("[Stripe Mock] Retrieving PaymentIntent:", paymentIntentId);
    // In mock mode, return a successful payment for testing
    if (paymentIntentId.startsWith("mock_pi_")) {
      return {
        id: paymentIntentId,
        status: "succeeded",
        amount: 1000, // $10.00
        currency: "usd",
        paymentMethodType: "card",
        cardBrand: "visa",
        cardLast4: "4242",
      };
    }
    return null;
  }

  const retrieveOptions: Stripe.RequestOptions | undefined = stripeAccount
    ? { stripeAccount }
    : undefined;

  try {
    const paymentIntent = await stripe!.paymentIntents.retrieve(
      paymentIntentId,
      {
        expand: ["latest_charge.payment_method_details"],
      },
      retrieveOptions
    );

    const charge = paymentIntent.latest_charge as Stripe.Charge | null;
    const cardDetails = charge?.payment_method_details?.card;

    return {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      metadata: paymentIntent.metadata as Record<string, string>,
      paymentMethodType: charge?.payment_method_details?.type,
      cardBrand: cardDetails?.brand || undefined,
      cardLast4: cardDetails?.last4 || undefined,
    };
  } catch (err) {
    console.error("Failed to retrieve PaymentIntent:", err);
    return null;
  }
}

// ==================== Customer Methods ====================

/**
 * Create a new Stripe customer
 */
async function createCustomer(input: CreateCustomerInput): Promise<string> {
  if (isMockMode()) {
    const mockId = `mock_cus_${crypto.randomUUID().slice(0, 8)}`;
    console.log("[Stripe Mock] Creating Customer:", {
      email: input.email,
      name: input.name,
      metadata: input.metadata,
    });
    return mockId;
  }

  const customer = await stripe!.customers.create({
    email: input.email,
    name: input.name,
    metadata: input.metadata,
  });

  return customer.id;
}

// ==================== Subscription Methods ====================

/**
 * Create a Checkout Session for subscription
 */
async function createSubscriptionCheckoutSession(
  input: CreateSubscriptionCheckoutInput
): Promise<SubscriptionCheckoutResult> {
  if (isMockMode()) {
    const mockSessionId = `mock_cs_${crypto.randomUUID().slice(0, 8)}`;
    console.log("[Stripe Mock] Creating subscription checkout session:", {
      customerId: input.customerId,
      priceId: input.priceId,
      tenantId: input.tenantId,
      trialDays: input.trialDays,
    });
    return {
      sessionId: mockSessionId,
      url: `https://mock-stripe.com/checkout/${mockSessionId}`,
    };
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: input.customerId,
    mode: "subscription",
    line_items: [
      {
        price: input.priceId,
        quantity: 1,
      },
    ],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: {
      tenantId: input.tenantId,
    },
    subscription_data: {
      metadata: {
        tenantId: input.tenantId,
      },
    },
  };

  // Add trial if specified
  if (input.trialDays && input.trialDays > 0) {
    sessionParams.subscription_data!.trial_period_days = input.trialDays;
  }

  const session = await stripe!.checkout.sessions.create(sessionParams);

  return {
    sessionId: session.id,
    url: session.url!,
  };
}

/**
 * Create a Billing Portal session for managing subscription
 */
async function createBillingPortalSession(
  input: CreateBillingPortalInput
): Promise<BillingPortalResult> {
  if (isMockMode()) {
    console.log("[Stripe Mock] Creating billing portal session:", {
      customerId: input.customerId,
      returnUrl: input.returnUrl,
    });
    return {
      url: `https://mock-stripe.com/billing-portal/${input.customerId}`,
    };
  }

  const session = await stripe!.billingPortal.sessions.create({
    customer: input.customerId,
    return_url: input.returnUrl,
  });

  return {
    url: session.url,
  };
}

/**
 * Cancel a subscription
 */
async function cancelSubscription(
  subscriptionId: string,
  cancelAtPeriodEnd: boolean = true
): Promise<void> {
  if (isMockMode()) {
    console.log("[Stripe Mock] Canceling subscription:", {
      subscriptionId,
      cancelAtPeriodEnd,
    });
    return;
  }

  if (cancelAtPeriodEnd) {
    // Cancel at end of billing period
    await stripe!.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  } else {
    // Cancel immediately
    await stripe!.subscriptions.cancel(subscriptionId);
  }
}

/**
 * Resume a canceled subscription (before period ends)
 */
async function resumeSubscription(subscriptionId: string): Promise<void> {
  if (isMockMode()) {
    console.log("[Stripe Mock] Resuming subscription:", subscriptionId);
    return;
  }

  await stripe!.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

/**
 * Get subscription by ID
 */
async function getSubscription(
  subscriptionId: string
): Promise<StripeSubscriptionInfo | null> {
  if (isMockMode()) {
    console.log("[Stripe Mock] Getting subscription:", subscriptionId);
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    return {
      id: subscriptionId,
      status: "active",
      customerId: "mock_cus_123",
      priceId: "mock_price_123",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialStart: null,
      trialEnd: null,
      cancelAtPeriodEnd: false,
      canceledAt: null,
    };
  }

  try {
    const subscription = await stripe!.subscriptions.retrieve(subscriptionId);
    // In Stripe SDK v20+, billing period is on subscription items
    const firstItem = subscription.items.data[0];
    return {
      id: subscription.id,
      status: subscription.status,
      customerId:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id,
      priceId: firstItem?.price?.id || null,
      currentPeriodStart: firstItem
        ? new Date(firstItem.current_period_start * 1000)
        : new Date(),
      currentPeriodEnd: firstItem
        ? new Date(firstItem.current_period_end * 1000)
        : new Date(),
      trialStart: subscription.trial_start
        ? new Date(subscription.trial_start * 1000)
        : null,
      trialEnd: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
    };
  } catch (err) {
    console.error("Failed to retrieve subscription:", err);
    return null;
  }
}
// ==================== Connect Methods ====================

/**
 * Generate OAuth URL for Stripe Connect onboarding
 */
function generateConnectOAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  return `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${clientId}&scope=read_write&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&stripe_landing=register`;
}

/**
 * Handle OAuth callback and exchange code for access token
 */
async function handleConnectOAuthCallback(
  code: string
): Promise<StripeOAuthTokenResponse> {
  if (isMockMode()) {
    console.log("[Stripe Mock] Handling Connect OAuth callback:", { code });
    return {
      access_token: `mock_access_token_${crypto.randomUUID().slice(0, 8)}`,
      refresh_token: `mock_refresh_token_${crypto.randomUUID().slice(0, 8)}`,
      stripe_user_id: `mock_acct_${crypto.randomUUID().slice(0, 8)}`,
      scope: "read_write",
    };
  }

  const token = await stripe!.oauth.token({
    grant_type: "authorization_code",
    code,
  });

  return {
    access_token: token.access_token ?? "",
    refresh_token: token.refresh_token ?? "",
    stripe_user_id: token.stripe_user_id ?? "",
    scope: token.scope ?? "",
  };
}

/**
 * Retrieve Connect account status
 */
async function getConnectAccountStatus(
  stripeAccountId: string
): Promise<StripeAccountInfo> {
  if (isMockMode()) {
    console.log(
      "[Stripe Mock] Getting Connect account status:",
      stripeAccountId
    );
    return {
      id: stripeAccountId,
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
    };
  }

  const account = await stripe!.accounts.retrieve(stripeAccountId);

  return {
    id: account.id,
    charges_enabled: account.charges_enabled ?? false,
    payouts_enabled: account.payouts_enabled ?? false,
    details_submitted: account.details_submitted ?? false,
  };
}

/**
 * Disconnect a connected account via OAuth deauthorize
 */
async function disconnectConnectAccount(stripeAccountId: string): Promise<void> {
  if (isMockMode()) {
    console.log(
      "[Stripe Mock] Disconnecting Connect account:",
      stripeAccountId
    );
    return;
  }

  await stripe!.oauth.deauthorize({
    client_id: STRIPE_CONNECT_CLIENT_ID ?? "",
    stripe_user_id: stripeAccountId,
  });
}

/**
 * Verify Stripe Connect webhook signature
 */
function verifyConnectWebhookSignature(
  payload: string,
  signature: string
): Stripe.Event {
  if (isMockMode() || !STRIPE_CONNECT_WEBHOOK_SECRET) {
    if (!STRIPE_CONNECT_WEBHOOK_SECRET) {
      throw new Error("STRIPE_CONNECT_WEBHOOK_SECRET is not configured");
    }
    console.log("[Stripe Mock] Skipping Connect webhook verification");
    return JSON.parse(payload) as Stripe.Event;
  }

  return stripe!.webhooks.constructEvent(
    payload,
    signature,
    STRIPE_CONNECT_WEBHOOK_SECRET
  );
}

/**
 * Update subscription to a new price (plan change with proration)
 */
async function updateSubscriptionPrice(
  input: UpdateSubscriptionPriceInput
): Promise<StripeSubscriptionInfo | null> {
  if (isMockMode()) {
    console.log("[Stripe Mock] Updating subscription price:", {
      subscriptionId: input.subscriptionId,
      currentPriceId: input.currentPriceId,
      newPriceId: input.newPriceId,
    });
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    return {
      id: input.subscriptionId,
      status: "active",
      customerId: "mock_cus_123",
      priceId: input.newPriceId,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialStart: null,
      trialEnd: null,
      cancelAtPeriodEnd: false,
      canceledAt: null,
    };
  }

  try {
    // Retrieve the subscription to find the item ID
    const subscription = await stripe!.subscriptions.retrieve(
      input.subscriptionId
    );

    // Find the subscription item with the current price
    const item = subscription.items.data.find(
      (si) => si.price.id === input.currentPriceId
    );

    if (!item) {
      console.error(
        "[Stripe] Could not find subscription item with price:",
        input.currentPriceId
      );
      return null;
    }

    // Update the subscription item's price with proration
    const updated = await stripe!.subscriptions.update(
      input.subscriptionId,
      {
        items: [
          {
            id: item.id,
            price: input.newPriceId,
          },
        ],
        proration_behavior: "create_prorations",
      }
    );

    const firstItem = updated.items.data[0];
    return {
      id: updated.id,
      status: updated.status,
      customerId:
        typeof updated.customer === "string"
          ? updated.customer
          : updated.customer.id,
      priceId: firstItem?.price?.id || null,
      currentPeriodStart: firstItem
        ? new Date(firstItem.current_period_start * 1000)
        : new Date(),
      currentPeriodEnd: firstItem
        ? new Date(firstItem.current_period_end * 1000)
        : new Date(),
      trialStart: updated.trial_start
        ? new Date(updated.trial_start * 1000)
        : null,
      trialEnd: updated.trial_end
        ? new Date(updated.trial_end * 1000)
        : null,
      cancelAtPeriodEnd: updated.cancel_at_period_end,
      canceledAt: updated.canceled_at
        ? new Date(updated.canceled_at * 1000)
        : null,
    };
  } catch (err) {
    console.error("Failed to update subscription price:", err);
    return null;
  }
}

export const stripeService = {
  createPaymentLink,
  verifyWebhookSignature,
  isConfigured,
  createPaymentIntent,
  retrievePaymentIntent,
  createCustomer,
  createSubscriptionCheckoutSession,
  createBillingPortalSession,
  cancelSubscription,
  resumeSubscription,
  getSubscription,
  generateConnectOAuthUrl,
  handleConnectOAuthCallback,
  getConnectAccountStatus,
  disconnectConnectAccount,
  verifyConnectWebhookSignature,
  updateSubscriptionPrice,
};
