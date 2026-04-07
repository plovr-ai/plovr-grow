import prisma from "@/lib/db";
import { generateEntityId } from "@/lib/id";

export interface CreateSubscriptionInput {
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  status?: string;
  plan?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialStart?: Date;
  trialEnd?: Date;
}

export interface UpdateSubscriptionInput {
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  status?: string;
  plan?: string;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  trialStart?: Date | null;
  trialEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date | null;
  gracePeriodEnd?: Date | null;
}

export class SubscriptionRepository {
  /**
   * Get subscription by tenant ID
   */
  async getByTenantId(tenantId: string) {
    return prisma.subscription.findFirst({
      where: { tenantId, deleted: false },
    });
  }

  /**
   * Get subscription by Stripe customer ID
   */
  async getByStripeCustomerId(stripeCustomerId: string) {
    return prisma.subscription.findFirst({
      where: { stripeCustomerId, deleted: false },
    });
  }

  /**
   * Get subscription by Stripe subscription ID
   */
  async getByStripeSubscriptionId(stripeSubscriptionId: string) {
    return prisma.subscription.findFirst({
      where: { stripeSubscriptionId, deleted: false },
    });
  }

  /**
   * Get subscription with tenant details
   */
  async getWithTenant(tenantId: string) {
    return prisma.subscription.findFirst({
      where: { tenantId, deleted: false },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subscriptionPlan: true,
            subscriptionStatus: true,
          },
        },
      },
    });
  }

  /**
   * Create a new subscription
   */
  async create(tenantId: string, data: CreateSubscriptionInput) {
    return prisma.subscription.create({
      data: {
        id: generateEntityId(),
        tenantId,
        stripeCustomerId: data.stripeCustomerId,
        stripeSubscriptionId: data.stripeSubscriptionId,
        stripePriceId: data.stripePriceId,
        status: data.status ?? "incomplete",
        plan: data.plan ?? "standard",
        currentPeriodStart: data.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd,
        trialStart: data.trialStart,
        trialEnd: data.trialEnd,
      },
    });
  }

  /**
   * Update subscription by ID
   */
  async update(id: string, data: UpdateSubscriptionInput) {
    return prisma.subscription.update({
      where: { id },
      data,
    });
  }

  /**
   * Update subscription by tenant ID
   */
  async updateByTenantId(tenantId: string, data: UpdateSubscriptionInput) {
    return prisma.subscription.update({
      where: { tenantId },
      data,
    });
  }

  /**
   * Update subscription by Stripe subscription ID
   */
  async updateByStripeSubscriptionId(
    stripeSubscriptionId: string,
    data: UpdateSubscriptionInput
  ) {
    return prisma.subscription.update({
      where: { stripeSubscriptionId },
      data,
    });
  }

  /**
   * Update subscription by Stripe customer ID
   */
  async updateByStripeCustomerId(
    stripeCustomerId: string,
    data: UpdateSubscriptionInput
  ) {
    return prisma.subscription.update({
      where: { stripeCustomerId },
      data,
    });
  }

  /**
   * Delete subscription by ID
   */
  async delete(id: string) {
    return prisma.subscription.update({
      where: { id },
      data: { deleted: true, updatedAt: new Date() },
    });
  }

  /**
   * Delete subscription by tenant ID
   */
  async deleteByTenantId(tenantId: string) {
    return prisma.subscription.update({
      where: { tenantId },
      data: { deleted: true, updatedAt: new Date() },
    });
  }

  /**
   * Update tenant's denormalized subscription fields
   */
  async updateTenantSubscriptionStatus(
    tenantId: string,
    subscriptionPlan: string,
    subscriptionStatus: string
  ) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionPlan,
        subscriptionStatus,
      },
    });
  }

  /**
   * Check if subscription exists for tenant
   */
  async exists(tenantId: string): Promise<boolean> {
    const count = await prisma.subscription.count({
      where: { tenantId, deleted: false },
    });
    return count > 0;
  }
}

export const subscriptionRepository = new SubscriptionRepository();
