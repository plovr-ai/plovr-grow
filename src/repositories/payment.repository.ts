import prisma from "@/lib/db";
import type { DbClient } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { generateEntityId } from "@/lib/id";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCodes } from "@/lib/errors/error-codes";

export const PAYMENT_STATUSES = [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "canceled",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ["card", "apple_pay", "google_pay"] as const;
export type PaymentMethodType = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_PROVIDERS = [
  "stripe",
  "square",
  "cash",
  "external",
] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export interface CreatePaymentInput {
  orderId: string;
  provider: PaymentProvider;
  providerPaymentId?: string | null;
  amount: number;
  currency: string;
  stripeDetail?: {
    stripeAccountId: string;
    stripeCustomerId?: string | null;
  };
}

export interface UpdatePaymentStatusInput {
  status: PaymentStatus;
  paymentMethod?: string | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  paidAt?: Date | null;
}

export class PaymentRepository {
  /**
   * Create a new payment record, optionally with Stripe-specific details
   */
  async create(tenantId: string, data: CreatePaymentInput, tx?: DbClient) {
    const db = tx ?? prisma;
    return db.payment.create({
      data: {
        id: generateEntityId(),
        tenantId,
        orderId: data.orderId,
        provider: data.provider,
        providerPaymentId: data.providerPaymentId,
        amount: data.amount,
        currency: data.currency,
        status: "pending",
        ...(data.stripeDetail && {
          stripeDetail: {
            create: {
              id: generateEntityId(),
              stripeAccountId: data.stripeDetail.stripeAccountId,
              stripeCustomerId: data.stripeDetail.stripeCustomerId,
            },
          },
        }),
      },
      include: {
        stripeDetail: true,
      },
    });
  }

  /**
   * Get payment by ID
   */
  async getById(tenantId: string, id: string) {
    return prisma.payment.findFirst({
      where: {
        id,
        tenantId,
        deleted: false,
      },
    });
  }

  /**
   * Get payment by provider and provider payment ID
   */
  async getByProviderPaymentId(provider: PaymentProvider, providerPaymentId: string) {
    return prisma.payment.findFirst({
      where: {
        provider,
        providerPaymentId,
        deleted: false,
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            tenantId: true,
            merchantId: true,
          },
        },
        stripeDetail: true,
      },
    });
  }

  /**
   * Get payments for an order
   */
  async getByOrderId(tenantId: string, orderId: string) {
    return prisma.payment.findMany({
      where: {
        tenantId,
        orderId,
        deleted: false,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Get the most recent successful payment for an order
   */
  async getSuccessfulPaymentByOrderId(tenantId: string, orderId: string) {
    return prisma.payment.findFirst({
      where: {
        tenantId,
        orderId,
        status: "succeeded",
        deleted: false,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Update payment status
   */
  async updateStatus(id: string, data: UpdatePaymentStatusInput) {
    const updateData: Prisma.PaymentUpdateInput = {
      status: data.status,
    };

    if (data.paymentMethod !== undefined) {
      updateData.paymentMethod = data.paymentMethod;
    }
    if (data.cardBrand !== undefined) {
      updateData.cardBrand = data.cardBrand;
    }
    if (data.cardLast4 !== undefined) {
      updateData.cardLast4 = data.cardLast4;
    }
    if (data.failureCode !== undefined) {
      updateData.failureCode = data.failureCode;
    }
    if (data.failureMessage !== undefined) {
      updateData.failureMessage = data.failureMessage;
    }
    if (data.paidAt !== undefined) {
      updateData.paidAt = data.paidAt;
    }

    return prisma.payment.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Atomic status update using Compare-And-Swap (CAS) pattern.
   * Only updates if the current status matches expectedStatus.
   * Returns the number of rows updated (0 or 1).
   */
  async atomicUpdateStatus(
    provider: PaymentProvider,
    providerPaymentId: string,
    expectedStatus: PaymentStatus,
    data: UpdatePaymentStatusInput
  ): Promise<number> {
    const updateData: Prisma.PaymentUpdateManyMutationInput = {
      status: data.status,
    };

    if (data.paymentMethod !== undefined) {
      updateData.paymentMethod = data.paymentMethod;
    }
    if (data.cardBrand !== undefined) {
      updateData.cardBrand = data.cardBrand;
    }
    if (data.cardLast4 !== undefined) {
      updateData.cardLast4 = data.cardLast4;
    }
    if (data.failureCode !== undefined) {
      updateData.failureCode = data.failureCode;
    }
    if (data.failureMessage !== undefined) {
      updateData.failureMessage = data.failureMessage;
    }
    if (data.paidAt !== undefined) {
      updateData.paidAt = data.paidAt;
    }

    const result = await prisma.payment.updateMany({
      where: {
        provider,
        providerPaymentId,
        status: expectedStatus,
        deleted: false,
      },
      data: updateData,
    });

    return result.count;
  }

  /**
   * Update payment by provider and provider payment ID
   */
  async updateByProviderPaymentId(
    provider: PaymentProvider,
    providerPaymentId: string,
    data: UpdatePaymentStatusInput
  ) {
    const updateData: Prisma.PaymentUpdateInput = {
      status: data.status,
    };

    if (data.paymentMethod !== undefined) {
      updateData.paymentMethod = data.paymentMethod;
    }
    if (data.cardBrand !== undefined) {
      updateData.cardBrand = data.cardBrand;
    }
    if (data.cardLast4 !== undefined) {
      updateData.cardLast4 = data.cardLast4;
    }
    if (data.failureCode !== undefined) {
      updateData.failureCode = data.failureCode;
    }
    if (data.failureMessage !== undefined) {
      updateData.failureMessage = data.failureMessage;
    }
    if (data.paidAt !== undefined) {
      updateData.paidAt = data.paidAt;
    }

    // Use findFirst + update since composite unique needs special handling
    const payment = await prisma.payment.findFirst({
      where: { provider, providerPaymentId, deleted: false },
    });

    if (!payment) {
      throw new AppError(ErrorCodes.PAYMENT_NOT_FOUND, undefined, 404);
    }

    return prisma.payment.update({
      where: { id: payment.id },
      data: updateData,
    });
  }

  /**
   * Check if payment already exists for a provider + payment ID combination
   */
  async providerPaymentExists(
    provider: PaymentProvider,
    providerPaymentId: string
  ): Promise<boolean> {
    const payment = await prisma.payment.findFirst({
      where: { provider, providerPaymentId, deleted: false },
    });
    return payment !== null;
  }
}

export const paymentRepository = new PaymentRepository();
