import { AppError } from "@/lib/errors/app-error";
import { ErrorCodes } from "@/lib/errors/error-codes";
import { stripeService } from "@/services/stripe/stripe.service";
import {
  subscriptionRepository,
  type UpdateSubscriptionInput,
} from "@/repositories/subscription.repository";
import type {
  SubscriptionInfo,
  SubscriptionStatus,
  SubscriptionPlan,
  CheckoutSessionOptions,
  StripeSubscriptionData,
  StripeInvoiceData,
  StripeCheckoutSessionData,
  DashboardSubscriptionInfo,
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

export class SubscriptionService {
  // ==================== Read Operations ====================

  /**
   * Get subscription info for a tenant
   */
  async getSubscription(tenantId: string): Promise<SubscriptionInfo | null> {
    const subscription = await subscriptionRepository.getByTenantId(tenantId);
    if (!subscription) {
      return null;
    }

    return this.toSubscriptionInfo(subscription);
  }

  /**
   * Get subscription info for Dashboard context
   */
  async getSubscriptionForDashboard(
    tenantId: string
  ): Promise<DashboardSubscriptionInfo | null> {
    const subscription = await this.getSubscription(tenantId);
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
  async isSubscriptionActive(tenantId: string): Promise<boolean> {
    const subscription = await subscriptionRepository.getByTenantId(tenantId);
    if (!subscription) {
      return false;
    }
    return subscription.status === "active" || subscription.status === "trialing";
  }

  /**
   * Check if tenant can access premium features
   * (active, trialing, or in grace period)
   */
  async canAccessPremiumFeatures(tenantId: string): Promise<boolean> {
    const subscription = await subscriptionRepository.getByTenantId(tenantId);
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

  // ==================== Subscription Management ====================

  /**
   * Create checkout session for new subscription
   */
  async createCheckoutSession(
    tenantId: string,
    planCode: string,
    options?: Partial<CheckoutSessionOptions>
  ): Promise<{ url: string; sessionId: string }> {
    const plan = getPlanByCode(planCode);
    if (!plan) {
      throw new AppError(ErrorCodes.INVALID_PLAN_CODE, { planCode }, 400);
    }

    const stripePriceId = getStripePriceId(planCode);
    if (!stripePriceId) {
      throw new AppError(ErrorCodes.STRIPE_PRICE_NOT_CONFIGURED, { planCode }, 500);
    }

    const stripeCustomerId = await this.getOrCreateStripeCustomer(tenantId);

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
    });

    return {
      url: result.url,
      sessionId: result.sessionId,
    };
  }

  /**
   * Create billing portal session for managing payment methods
   */
  async createBillingPortalSession(
    tenantId: string,
    returnUrl?: string
  ): Promise<{ url: string }> {
    const subscription = await subscriptionRepository.getByTenantId(tenantId);
    if (!subscription) {
      throw new AppError(ErrorCodes.SUBSCRIPTION_NOT_FOUND, undefined, 404);
    }

    const result = await stripeService.createBillingPortalSession({
      customerId: subscription.stripeCustomerId,
      returnUrl: returnUrl ?? `${APP_URL}/dashboard/subscription`,
    });

    return { url: result.url };
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    tenantId: string,
    cancelImmediately: boolean = false
  ): Promise<void> {
    const subscription = await subscriptionRepository.getByTenantId(tenantId);
    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new AppError(ErrorCodes.SUBSCRIPTION_NOT_FOUND, undefined, 404);
    }

    await stripeService.cancelSubscription(
      subscription.stripeSubscriptionId,
      !cancelImmediately // cancelAtPeriodEnd
    );

    // Update local record
    await subscriptionRepository.updateByTenantId(tenantId, {
      cancelAtPeriodEnd: !cancelImmediately,
      canceledAt: cancelImmediately ? new Date() : null,
    });
  }

  /**
   * Resume canceled subscription (before period ends)
   */
  async resumeSubscription(tenantId: string): Promise<void> {
    const subscription = await subscriptionRepository.getByTenantId(tenantId);
    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new AppError(ErrorCodes.SUBSCRIPTION_NOT_FOUND, undefined, 404);
    }

    if (!subscription.cancelAtPeriodEnd) {
      throw new AppError(ErrorCodes.SUBSCRIPTION_NOT_CANCELLING, undefined, 400);
    }

    await stripeService.resumeSubscription(subscription.stripeSubscriptionId);

    // Update local record
    await subscriptionRepository.updateByTenantId(tenantId, {
      cancelAtPeriodEnd: false,
      canceledAt: null,
    });
  }

  /**
   * Change subscription plan (upgrade/downgrade with proration)
   */
  async changePlan(tenantId: string, newPlanCode: string): Promise<void> {
    const plan = getPlanByCode(newPlanCode);
    if (!plan) {
      throw new AppError(ErrorCodes.INVALID_PLAN_CODE, { planCode: newPlanCode }, 400);
    }

    const newStripePriceId = getStripePriceId(newPlanCode);
    if (!newStripePriceId) {
      throw new AppError(ErrorCodes.STRIPE_PRICE_NOT_CONFIGURED, { planCode: newPlanCode }, 500);
    }

    const subscription = await subscriptionRepository.getByTenantId(tenantId);
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

    await this.updateTenantSubscriptionStatus(tenantId, newPlanCode, subscription.status);
  }

  // ==================== Webhook Handlers ====================

  /**
   * Handle checkout.session.completed event
   */
  async handleCheckoutSessionCompleted(
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

    // Check if subscription record exists
    const existingSubscription =
      await subscriptionRepository.getByTenantId(tenantId);

    const detectedPlan = stripeSubscription.priceId
      ? getPlanByStripePriceId(stripeSubscription.priceId)
      : undefined;
    const planCode = detectedPlan?.code ?? "starter";

    if (existingSubscription) {
      // Update existing subscription
      await subscriptionRepository.updateByTenantId(tenantId, {
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
      await subscriptionRepository.create(tenantId, {
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

    // Update tenant's denormalized status
    await this.updateTenantSubscriptionStatus(
      tenantId,
      planCode,
      stripeSubscription.status
    );

    console.log(
      `[Subscription] Checkout completed for tenant ${tenantId}, status: ${stripeSubscription.status}`
    );
  }

  /**
   * Handle customer.subscription.created event
   */
  async handleSubscriptionCreated(
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
    const planCode = planFromPrice?.code ?? "starter";

    // Check if already exists (might have been created by checkout handler)
    const existing = await subscriptionRepository.getByStripeSubscriptionId(
      subscription.id
    );
    if (existing) {
      return;
    }

    await subscriptionRepository.create(tenantId, {
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

    await this.updateTenantSubscriptionStatus(
      tenantId,
      planCode,
      subscription.status
    );

    console.log(
      `[Subscription] Created for tenant ${tenantId}, status: ${subscription.status}`
    );
  }

  /**
   * Handle customer.subscription.updated event
   */
  async handleSubscriptionUpdated(
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
        await this.handleSubscriptionCreated(subscription);
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
      const detectedPlan = getPlanByStripePriceId(priceId);
      if (detectedPlan) {
        updateData.plan = detectedPlan.code;
      }
    }

    await subscriptionRepository.update(existingSubscription.id, updateData);

    // Update tenant's denormalized status
    const currentPlan = priceId
      ? (getPlanByStripePriceId(priceId)?.code ?? existingSubscription.plan)
      : existingSubscription.plan;
    await this.updateTenantSubscriptionStatus(
      existingSubscription.tenantId,
      currentPlan,
      subscription.status
    );

    console.log(
      `[Subscription] Updated for tenant ${existingSubscription.tenantId}, status: ${subscription.status}`
    );
  }

  /**
   * Handle customer.subscription.deleted event
   */
  async handleSubscriptionDeleted(
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

    // Update tenant's denormalized status
    await this.updateTenantSubscriptionStatus(
      existingSubscription.tenantId,
      "free",
      "canceled"
    );

    console.log(
      `[Subscription] Deleted for tenant ${existingSubscription.tenantId}`
    );
  }

  /**
   * Handle invoice.payment_succeeded event
   */
  async handleInvoicePaymentSucceeded(invoice: StripeInvoiceData): Promise<void> {
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

    await this.updateTenantSubscriptionStatus(
      subscription.tenantId,
      subscription.plan,
      "active"
    );

    console.log(
      `[Subscription] Invoice payment succeeded for tenant ${subscription.tenantId}`
    );
  }

  /**
   * Handle invoice.payment_failed event
   */
  async handleInvoicePaymentFailed(invoice: StripeInvoiceData): Promise<void> {
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

    await this.updateTenantSubscriptionStatus(
      subscription.tenantId,
      subscription.plan,
      "past_due"
    );

    console.log(
      `[Subscription] Invoice payment failed for tenant ${subscription.tenantId}, grace period ends: ${gracePeriodEnd.toISOString()}`
    );

    // TODO: Send notification email to tenant owner
  }

  // ==================== Internal Helpers ====================

  /**
   * Get or create Stripe customer for tenant
   */
  private async getOrCreateStripeCustomer(tenantId: string): Promise<string> {
    // Check if subscription already exists with a customer
    const existing = await subscriptionRepository.getByTenantId(tenantId);
    if (existing) {
      return existing.stripeCustomerId;
    }

    // Get tenant info for customer creation
    const tenant = await this.getTenantInfo(tenantId);
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
    await subscriptionRepository.create(tenantId, {
      stripeCustomerId,
      status: "incomplete",
    });

    return stripeCustomerId;
  }

  /**
   * Update tenant's denormalized subscription fields
   */
  private async updateTenantSubscriptionStatus(
    tenantId: string,
    plan: string,
    status: string
  ): Promise<void> {
    await subscriptionRepository.updateTenantSubscriptionStatus(
      tenantId,
      plan,
      status
    );
  }

  /**
   * Get tenant info (uses raw query to avoid circular imports)
   */
  private async getTenantInfo(
    tenantId: string
  ): Promise<{ name: string; email: string | null } | null> {
    // Import prisma directly to avoid service layer circular dependency
    const { default: prisma } = await import("@/lib/db");

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        supportEmail: true,
      },
    });

    if (!tenant) return null;

    return {
      name: tenant.name,
      email: tenant.supportEmail ?? null,
    };
  }

  /**
   * Convert database subscription to SubscriptionInfo
   */
  private toSubscriptionInfo(subscription: {
    id: string;
    tenantId: string;
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
}

export const subscriptionService = new SubscriptionService();
