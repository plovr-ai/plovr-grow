import prisma from "@/lib/db";
import type { DbClient } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { generateEntityId } from "@/lib/id";

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

export interface CreatePaymentInput {
  orderId: string;
  stripePaymentIntentId: string;
  stripeAccountId?: string | null;
  stripeCustomerId?: string | null;
  amount: number;
  currency: string;
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
   * Create a new payment record
   */
  async create(tenantId: string, data: CreatePaymentInput, tx?: DbClient) {
    const db = tx ?? prisma;
    return db.payment.create({
      data: {
        id: generateEntityId(),
        tenantId,
        orderId: data.orderId,
        stripePaymentIntentId: data.stripePaymentIntentId,
        stripeAccountId: data.stripeAccountId,
        stripeCustomerId: data.stripeCustomerId,
        amount: data.amount,
        currency: data.currency,
        status: "pending",
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
   * Get payment by Stripe PaymentIntent ID
   */
  async getByPaymentIntentId(stripePaymentIntentId: string) {
    return prisma.payment.findFirst({
      where: {
        stripePaymentIntentId,
        deleted: false,
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            tenantId: true,
            companyId: true,
            merchantId: true,
          },
        },
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
    paymentIntentId: string,
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
        stripePaymentIntentId: paymentIntentId,
        status: expectedStatus,
        deleted: false,
      },
      data: updateData,
    });

    return result.count;
  }

  /**
   * Update payment by Stripe PaymentIntent ID
   */
  async updateByPaymentIntentId(
    stripePaymentIntentId: string,
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

    return prisma.payment.update({
      where: { stripePaymentIntentId },
      data: updateData,
    });
  }

  /**
   * Check if payment already exists for a PaymentIntent
   */
  async paymentIntentExists(stripePaymentIntentId: string): Promise<boolean> {
    const payment = await prisma.payment.findFirst({
      where: { stripePaymentIntentId, deleted: false },
    });
    return payment !== null;
  }
}

export const paymentRepository = new PaymentRepository();
