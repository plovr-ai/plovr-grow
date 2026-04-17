import prisma from "@/lib/db";
import { generateEntityId } from "@/lib/id";
import type { ProductLine } from "@/services/subscription/subscription.types";

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
  async getByTenantId(tenantId: string, productLine: ProductLine) {
    return prisma.subscription.findFirst({
      where: { tenantId, productLine, deleted: false },
    });
  }

  async getAllByTenantId(tenantId: string) {
    return prisma.subscription.findMany({
      where: { tenantId, deleted: false },
    });
  }

  async getByStripeCustomerId(stripeCustomerId: string) {
    return prisma.subscription.findFirst({
      where: { stripeCustomerId, deleted: false },
    });
  }

  async getByStripeSubscriptionId(stripeSubscriptionId: string) {
    return prisma.subscription.findFirst({
      where: { stripeSubscriptionId, deleted: false },
    });
  }

  async create(tenantId: string, productLine: ProductLine, data: CreateSubscriptionInput) {
    return prisma.subscription.create({
      data: {
        id: generateEntityId(),
        tenantId,
        productLine,
        stripeCustomerId: data.stripeCustomerId,
        stripeSubscriptionId: data.stripeSubscriptionId,
        stripePriceId: data.stripePriceId,
        status: data.status ?? "incomplete",
        plan: data.plan ?? "free",
        currentPeriodStart: data.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd,
        trialStart: data.trialStart,
        trialEnd: data.trialEnd,
      },
    });
  }

  async update(id: string, data: UpdateSubscriptionInput) {
    return prisma.subscription.update({
      where: { id },
      data,
    });
  }

  async updateByTenantId(tenantId: string, productLine: ProductLine, data: UpdateSubscriptionInput) {
    return prisma.subscription.update({
      where: { tenantId_productLine: { tenantId, productLine } },
      data,
    });
  }

  async updateByStripeSubscriptionId(
    stripeSubscriptionId: string,
    data: UpdateSubscriptionInput
  ) {
    return prisma.subscription.update({
      where: { stripeSubscriptionId },
      data,
    });
  }

  async delete(id: string) {
    return prisma.subscription.update({
      where: { id },
      data: { deleted: true, updatedAt: new Date() },
    });
  }

  async deleteByTenantId(tenantId: string, productLine: ProductLine) {
    return prisma.subscription.update({
      where: { tenantId_productLine: { tenantId, productLine } },
      data: { deleted: true, updatedAt: new Date() },
    });
  }

  async exists(tenantId: string, productLine: ProductLine): Promise<boolean> {
    const count = await prisma.subscription.count({
      where: { tenantId, productLine, deleted: false },
    });
    return count > 0;
  }
}

export const subscriptionRepository = new SubscriptionRepository();
