import { AppError } from "@/lib/errors/app-error";
import { ErrorCodes } from "@/lib/errors/error-codes";
import { stripeService } from "@/services/stripe/stripe.service";
import {
  subscriptionRepository,
  type UpdateSubscriptionInput,
} from "@/repositories/subscription.repository";
import { tenantRepository } from "@/repositories/tenant.repository";
import type {
  SubscriptionInfo,
  SubscriptionStatus,
  SubscriptionPlan,
  CheckoutSessionOptions,
  StripeSubscriptionData,
  StripeInvoiceData,
  StripeCheckoutSessionData,
  DashboardSubscriptionInfo,
  ProductLine,
} from "./subscription.types";
import {
  getStripePriceId,
  getPlanByCode,
  getPlanByStripePriceId,
} from "./subscription.plans";
const STRIPE_TRIAL_DAYS = parseInt(process.env.STRIPE_TRIAL_DAYS ?? "14");
const STRIPE_GRACE_PERIOD_DAYS = parseInt(
  process.env.STRIPE_GRACE_PERIOD_DAYS ?? "7"
);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ==================== Read Operations ====================

/**
 * Get subscription info for a tenant
 */
async function getSubscription(tenantId: string, productLine: ProductLine): Promise<SubscriptionInfo | null> {
  const subscription = await subscriptionRepository.getByTenantId(tenantId, productLine);
  if (!subscription) {
    return null;
  }

  return toSubscriptionInfo(subscription);
}

/**
 * Get subscription info for Dashboard context
 */
async function getSubscriptionForDashboard(
  tenantId: string,
  productLine: ProductLine
): Promise<DashboardSubscriptionInfo | null> {
  const subscription = await getSubscription(tenantId, productLine);
  if (!subscription) {
    return null;
  }

  return {
    status: subscription.status,
    plan: subscription.plan,
    canAccessPremiumFeatures: subscription.canAccessPremiumFeatures,
    isTrialing: subscription.status === "trialing",
    trialDaysRemaining: subscription.trialDaysRemaining,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    currentPeriodEnd: subscription.currentPeriodEnd,
  };
}

/**
 * Check if tenant has active subscription
 */
async function isSubscriptionActive(tenantId: string, productLine: ProductLine): Promise<boolean> {
  const subscription = await subscriptionRepository.getByTenantId(tenantId, productLine);
  if (!subscription) {
    return false;
  }
  return subscription.status === "active" || subscription.status === "trialing";
}

/**
 * Check if tenant can access premium features
 * (active, trialing, or in grace period)
 */
async function canAccessPremiumFeatures(tenantId: string, productLine: ProductLine): Promise<boolean> {
  const subscription = await subscriptionRepository.getByTenantId(tenantId, productLine);
  if (!subscription) {
    return false;
  }

  // Active or trialing subscriptions have full access
  if (
    subscription.status === "active" ||
    subscription.status === "trialing"
  ) {
    return true;
  }

  // Past due subscriptions have access during grace period
  if (subscription.status === "past_due" && subscription.gracePeriodEnd) {
    return new Date() < subscription.gracePeriodEnd;
  }

  return false;
}

/**
 * Get all subscriptions for a tenant (all product lines)
 */
async function getAllSubscriptions(tenantId: string): Promise<SubscriptionInfo[]> {
  const subscriptions = await subscriptionRepository.getAllByTenantId(tenantId);
  return subscriptions.map((s) => toSubscriptionInfo(s));
}

// ==================== Subscription Management ====================

/**
 * Create checkout session for new subscription
 */
async function createCheckoutSession(
  tenantId: string,
  productLine: ProductLine,
  planCode: string,
  options?: Partial<CheckoutSessionOptions>
): Promise<{ url: string; sessionId: string }> {
  const plan = getPlanByCode(productLine, planCode);
  if (!plan) {
    throw new AppError(ErrorCodes.INVALID_PLAN_CODE, { planCode }, 400);
  }

  const stripePriceId = getStripePriceId(productLine, planCode);
  if (!stripePriceId) {
    throw new AppError(ErrorCodes.STRIPE_PRICE_NOT_CONFIGURED, { planCode }, 500);
  }

  const stripeCustomerId = await getOrCreateStripeCustomer(tenantId, productLine);

  const successUrl =
    options?.successUrl ?? `${APP_URL}/dashboard/subscription?success=true`;
  const cancelUrl =
    options?.cancelUrl ?? `${APP_URL}/dashboard/subscription?canceled=true`;

  const result = await stripeService.createSubscriptionCheckoutSession({
    customerId: stripeCustomerId,
    priceId: stripePriceId,
    tenantId,
    successUrl,
    cancelUrl,
    trialDays: STRIPE_TRIAL_DAYS,
    metadata: { productLine },
  });

  return {
    url: result.url,
    sessionId: result.sessionId,
  };
}

/**
 * Create billing portal session for managing payment methods
 */
async function createBillingPortalSession(
  tenantId: string,
  returnUrl?: string
): Promise<{ url: string }> {
  const allSubscriptions = await subscriptionRepository.getAllByTenantId(tenantId);
  const withCustomer = allSubscriptions.find(s => s.stripeCustomerId);
  if (!withCustomer) {
    throw new AppError(ErrorCodes.SUBSCRIPTION_NOT_FOUND, undefined, 404);
  }

  const result = await stripeService.createBillingPortalSession({
    customerId: withCustomer.stripeCustomerId,
    returnUrl: returnUrl ?? `${APP_URL}/dashboard/subscription`,
  });

  return { url: result.url };
}

/**
 * Cancel subscription
 */
async function cancelSubscription(
  tenantId: string,
  productLine: ProductLine,
  cancelImmediately: boolean = false
): Promise<void> {
  const subscription = await subscriptionRepository.getByTenantId(tenantId, productLine);
  if (!subscription || !subscription.stripeSubscriptionId) {
    throw new AppError(ErrorCodes.SUBSCRIPTION_NOT_FOUND, undefined, 404);
  }

  await stripeService.cancelSubscription(
    subscription.stripeSubscriptionId,
    !cancelImmediately // cancelAtPeriodEnd
  );

  // Update local record
  await subscriptionRepository.updateByTenantId(tenantId, productLine, {
    cancelAtPeriodEnd: !cancelImmediately,
    canceledAt: cancelImmediately ? new Date() : null,
  });
}

/**
 * Resume canceled subscription (before period ends)
 */
async function resumeSubscription(tenantId: string, productLine: ProductLine): Promise<void> {
  const subscription = await subscriptionRepository.getByTenantId(tenantId, productLine);
  if (!subscription || !subscription.stripeSubscriptionId) {
    throw new AppError(ErrorCodes.SUBSCRIPTION_NOT_FOUND, undefined, 404);
  }

  if (!subscription.cancelAtPeriodEnd) {
    throw new AppError(ErrorCodes.SUBSCRIPTION_NOT_CANCELLING, undefined, 400);
  }

  await stripeService.resumeSubscription(subscription.stripeSubscriptionId);

  // Update local record
  await subscriptionRepository.updateByTenantId(tenantId, productLine, {
    cancelAtPeriodEnd: false,
    canceledAt: null,
  });
}

/**
 * Change subscription plan (upgrade/downgrade with proration)
 */
async function changePlan(tenantId: string, productLine: ProductLine, newPlanCode: string): Promise<void> {
  const plan = getPlanByCode(productLine, newPlanCode);
  if (!plan) {
    throw new AppError(ErrorCodes.INVALID_PLAN_CODE, { planCode: newPlanCode }, 400);
  }

  const newStripePriceId = getStripePriceId(productLine, newPlanCode);
  if (!newStripePriceId) {
    throw new AppError(ErrorCodes.STRIPE_PRICE_NOT_CONFIGURED, { planCode: newPlanCode }, 500);
  }

  const subscription = await subscriptionRepository.getByTenantId(tenantId, productLine);
  if (!subscription || !subscription.stripeSubscriptionId) {
    throw new AppError(ErrorCodes.SUBSCRIPTION_NOT_FOUND, undefined, 404);
  }

  if (subscription.status !== "active" && subscription.status !== "trialing") {
    throw new AppError(ErrorCodes.SUBSCRIPTION_NOT_FOUND, undefined, 404);
  }

  if (subscription.plan === newPlanCode) {
    throw new AppError(ErrorCodes.INVALID_PLAN_CODE, { planCode: newPlanCode }, 400);
  }

  if (!subscription.stripePriceId) {
    throw new AppError(ErrorCodes.STRIPE_PRICE_NOT_CONFIGURED, { planCode: subscription.plan }, 500);
  }

  const updated = await stripeService.updateSubscriptionPrice({
    subscriptionId: subscription.stripeSubscriptionId,
    currentPriceId: subscription.stripePriceId,
    newPriceId: newStripePriceId,
  });

  if (!updated) {
    throw new AppError(ErrorCodes.INTERNAL_ERROR, undefined, 500);
  }

  await subscriptionRepository.update(subscription.id, {
    plan: newPlanCode,
    stripePriceId: newStripePriceId,
  });
}

// ==================== Webhook Handlers ====================

/**
 * Handle checkout.session.completed event
 */
async function handleCheckoutSessionCompleted(
  session: StripeCheckoutSessionData
): Promise<void> {
  const tenantId = session.metadata.tenantId;
  if (!tenantId) {
    console.error(
      "[Subscription] Checkout session missing tenantId:",
      session.id
    );
    return;
  }

  if (session.mode !== "subscription" || !session.subscription) {
    return;
  }

  // Fetch the subscription details from Stripe
  const stripeSubscription = await stripeService.getSubscription(
    session.subscription
  );
  if (!stripeSubscription) {
    console.error(
      "[Subscription] Failed to fetch subscription:",
      session.subscription
    );
    return;
  }

  const productLine = (session.metadata.productLine ?? "platform") as ProductLine;

  // Check if subscription record exists
  const existingSubscription =
    await subscriptionRepository.getByTenantId(tenantId, productLine);

  const detected = stripeSubscription.priceId
    ? getPlanByStripePriceId(stripeSubscription.priceId)
    : undefined;
  const planCode = detected?.plan.code ?? "starter";

  if (existingSubscription) {
    // Update existing subscription
    await subscriptionRepository.updateByTenantId(tenantId, productLine, {
      stripeSubscriptionId: stripeSubscription.id,
      stripePriceId: stripeSubscription.priceId ?? undefined,
      plan: planCode,
      status: stripeSubscription.status as SubscriptionStatus,
      currentPeriodStart: stripeSubscription.currentPeriodStart,
      currentPeriodEnd: stripeSubscription.currentPeriodEnd,
      trialStart: stripeSubscription.trialStart,
      trialEnd: stripeSubscription.trialEnd,
      cancelAtPeriodEnd: stripeSubscription.cancelAtPeriodEnd,
      canceledAt: stripeSubscription.canceledAt,
    });
  } else {
    // Create new subscription record
    await subscriptionRepository.create(tenantId, productLine, {
      stripeCustomerId: session.customer,
      stripeSubscriptionId: stripeSubscription.id,
      stripePriceId: stripeSubscription.priceId ?? undefined,
      status: stripeSubscription.status as SubscriptionStatus,
      plan: planCode,
      currentPeriodStart: stripeSubscription.currentPeriodStart,
      currentPeriodEnd: stripeSubscription.currentPeriodEnd,
      trialStart: stripeSubscription.trialStart ?? undefined,
      trialEnd: stripeSubscription.trialEnd ?? undefined,
    });
  }

  console.log(
    `[Subscription] Checkout completed for tenant ${tenantId}, status: ${stripeSubscription.status}`
  );
}

/**
 * Handle customer.subscription.created event
 */
async function handleSubscriptionCreated(
  subscription: StripeSubscriptionData
): Promise<void> {
  const tenantId = subscription.metadata.tenantId;
  if (!tenantId) {
    console.warn(
      "[Subscription] Subscription created without tenantId:",
      subscription.id
    );
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id || null;

  const planFromPrice = priceId ? getPlanByStripePriceId(priceId) : undefined;
  const planCode = planFromPrice?.plan.code ?? "starter";

  // Check if already exists (might have been created by checkout handler)
  const existing = await subscriptionRepository.getByStripeSubscriptionId(
    subscription.id
  );
  if (existing) {
    return;
  }

  const productLine = (subscription.metadata.productLine ?? "platform") as ProductLine;

  await subscriptionRepository.create(tenantId, productLine, {
    stripeCustomerId: subscription.customer,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId ?? undefined,
    plan: planCode,
    status: subscription.status as SubscriptionStatus,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    trialStart: subscription.trial_start
      ? new Date(subscription.trial_start * 1000)
      : undefined,
    trialEnd: subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : undefined,
  });

  console.log(
    `[Subscription] Created for tenant ${tenantId}, status: ${subscription.status}`
  );
}

/**
 * Handle customer.subscription.updated event
 */
async function handleSubscriptionUpdated(
  subscription: StripeSubscriptionData
): Promise<void> {
  const existingSubscription =
    await subscriptionRepository.getByStripeSubscriptionId(subscription.id);

  if (!existingSubscription) {
    console.warn(
      "[Subscription] Subscription not found for update:",
      subscription.id
    );
    // Try to create if we have tenantId in metadata
    if (subscription.metadata.tenantId) {
      await handleSubscriptionCreated(subscription);
    }
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id || null;

  const updateData: UpdateSubscriptionInput = {
    status: subscription.status as SubscriptionStatus,
    stripePriceId: priceId ?? undefined,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
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

  if (priceId) {
    const detected = getPlanByStripePriceId(priceId);
    if (detected) {
      updateData.plan = detected.plan.code;
    }
  }

  await subscriptionRepository.update(existingSubscription.id, updateData);

  console.log(
    `[Subscription] Updated for tenant ${existingSubscription.tenantId}, status: ${subscription.status}`
  );
}

/**
 * Handle customer.subscription.deleted event
 */
async function handleSubscriptionDeleted(
  subscription: StripeSubscriptionData
): Promise<void> {
  const existingSubscription =
    await subscriptionRepository.getByStripeSubscriptionId(subscription.id);

  if (!existingSubscription) {
    console.warn(
      "[Subscription] Subscription not found for deletion:",
      subscription.id
    );
    return;
  }

  await subscriptionRepository.update(existingSubscription.id, {
    status: "canceled",
    canceledAt: new Date(),
  });

  console.log(
    `[Subscription] Deleted for tenant ${existingSubscription.tenantId}`
  );
}

/**
 * Handle invoice.payment_succeeded event
 */
async function handleInvoicePaymentSucceeded(invoice: StripeInvoiceData): Promise<void> {
  if (!invoice.subscription) {
    return;
  }

  const subscription = await subscriptionRepository.getByStripeSubscriptionId(
    invoice.subscription
  );
  if (!subscription) {
    console.warn(
      "[Subscription] Subscription not found for invoice:",
      invoice.subscription
    );
    return;
  }

  // Clear grace period if payment succeeded
  await subscriptionRepository.update(subscription.id, {
    status: "active",
    gracePeriodEnd: null,
  });

  console.log(
    `[Subscription] Invoice payment succeeded for tenant ${subscription.tenantId}`
  );
}

/**
 * Handle invoice.payment_failed event
 */
async function handleInvoicePaymentFailed(invoice: StripeInvoiceData): Promise<void> {
  if (!invoice.subscription) {
    return;
  }

  const subscription = await subscriptionRepository.getByStripeSubscriptionId(
    invoice.subscription
  );
  if (!subscription) {
    console.warn(
      "[Subscription] Subscription not found for failed invoice:",
      invoice.subscription
    );
    return;
  }

  // Set grace period
  const gracePeriodEnd = new Date();
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + STRIPE_GRACE_PERIOD_DAYS);

  await subscriptionRepository.update(subscription.id, {
    status: "past_due",
    gracePeriodEnd,
  });

  console.log(
    `[Subscription] Invoice payment failed for tenant ${subscription.tenantId}, grace period ends: ${gracePeriodEnd.toISOString()}`
  );

  // TODO: Send notification email to tenant owner
}

// ==================== Internal Helpers ====================

/**
 * Get or create Stripe customer for tenant
 */
async function getOrCreateStripeCustomer(tenantId: string, productLine: ProductLine): Promise<string> {
  // Check if any subscription exists with a customer
  const existingSubscriptions = await subscriptionRepository.getAllByTenantId(tenantId);
  const existingWithCustomer = existingSubscriptions.find(s => s.stripeCustomerId);
  if (existingWithCustomer) {
    return existingWithCustomer.stripeCustomerId;
  }

  // Get tenant info for customer creation
  const tenant = await getTenantInfo(tenantId);
  if (!tenant) {
    throw new AppError(ErrorCodes.TENANT_NOT_FOUND, undefined, 404);
  }

  // Create new Stripe customer
  const stripeCustomerId = await stripeService.createCustomer({
    email: tenant.email ?? `tenant-${tenantId}@plovr.app`,
    name: tenant.name,
    metadata: {
      tenantId,
    },
  });

  // Create subscription record with just the customer
  await subscriptionRepository.create(tenantId, productLine, {
    stripeCustomerId,
    status: "incomplete",
  });

  return stripeCustomerId;
}

/**
 * Get minimal tenant info for Stripe customer creation. We intentionally
 * hit the repository (rather than tenantService) to avoid a service-layer
 * circular import.
 */
async function getTenantInfo(
  tenantId: string
): Promise<{ name: string; email: string | null } | null> {
  const tenant = await tenantRepository.getNameAndSupportEmail(tenantId);
  if (!tenant) return null;

  return {
    name: tenant.name,
    email: tenant.supportEmail ?? null,
  };
}

/**
 * Convert database subscription to SubscriptionInfo
 */
function toSubscriptionInfo(subscription: {
  id: string;
  tenantId: string;
  productLine: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  status: string;
  plan: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  trialStart: Date | null;
  trialEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  gracePeriodEnd: Date | null;
}): SubscriptionInfo {
  const now = new Date();

  // Calculate if in grace period
  const isInGracePeriod =
    subscription.status === "past_due" &&
    subscription.gracePeriodEnd !== null &&
    now < subscription.gracePeriodEnd;

  // Calculate if can access premium features
  const canAccessPremiumFeatures =
    subscription.status === "active" ||
    subscription.status === "trialing" ||
    isInGracePeriod;

  // Calculate trial days remaining
  let trialDaysRemaining: number | null = null;
  if (subscription.status === "trialing" && subscription.trialEnd) {
    const diffMs = subscription.trialEnd.getTime() - now.getTime();
    trialDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  return {
    id: subscription.id,
    tenantId: subscription.tenantId,
    productLine: subscription.productLine as ProductLine,
    stripeCustomerId: subscription.stripeCustomerId,
    stripeSubscriptionId: subscription.stripeSubscriptionId,
    status: subscription.status as SubscriptionStatus,
    plan: subscription.plan as SubscriptionPlan,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    trialStart: subscription.trialStart,
    trialEnd: subscription.trialEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    canceledAt: subscription.canceledAt,
    gracePeriodEnd: subscription.gracePeriodEnd,
    isInGracePeriod,
    canAccessPremiumFeatures,
    trialDaysRemaining,
  };
}

export const subscriptionService = {
  getSubscription,
  getSubscriptionForDashboard,
  isSubscriptionActive,
  canAccessPremiumFeatures,
  getAllSubscriptions,
  createCheckoutSession,
  createBillingPortalSession,
  cancelSubscription,
  resumeSubscription,
  changePlan,
  handleCheckoutSessionCompleted,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaymentSucceeded,
  handleInvoicePaymentFailed,
};
