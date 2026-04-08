import prisma from "@/lib/db";
import type { DbClient } from "@/lib/db";
import { generateEntityId } from "@/lib/id";

export interface CreateConnectAccountInput {
  stripeAccountId: string;
  accessToken?: string;
  refreshToken?: string;
  scope?: string;
}

export interface UpdateAccountStatusInput {
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
}

export class StripeConnectAccountRepository {
  /**
   * Create a new Stripe Connect account record
   */
  async create(
    tenantId: string,
    data: CreateConnectAccountInput,
    tx?: DbClient
  ) {
    const db = tx ?? prisma;
    return db.stripeConnectAccount.create({
      data: {
        id: generateEntityId(),
        tenantId,
        stripeAccountId: data.stripeAccountId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        scope: data.scope,
        connectedAt: new Date(),
      },
    });
  }

  /**
   * Get Stripe Connect account by tenant ID
   */
  async getByTenantId(tenantId: string) {
    return prisma.stripeConnectAccount.findFirst({
      where: {
        tenantId,
        deleted: false,
      },
    });
  }

  /**
   * Get Stripe Connect account by Stripe account ID
   */
  async getByStripeAccountId(stripeAccountId: string) {
    return prisma.stripeConnectAccount.findFirst({
      where: {
        stripeAccountId,
        deleted: false,
      },
    });
  }

  /**
   * Update account status fields (chargesEnabled, payoutsEnabled, detailsSubmitted)
   */
  async updateAccountStatus(id: string, data: UpdateAccountStatusInput) {
    return prisma.stripeConnectAccount.update({
      where: { id },
      data: {
        ...(data.chargesEnabled !== undefined && {
          chargesEnabled: data.chargesEnabled,
        }),
        ...(data.payoutsEnabled !== undefined && {
          payoutsEnabled: data.payoutsEnabled,
        }),
        ...(data.detailsSubmitted !== undefined && {
          detailsSubmitted: data.detailsSubmitted,
        }),
      },
    });
  }

  /**
   * Soft delete a Stripe Connect account
   */
  async softDelete(id: string) {
    return prisma.stripeConnectAccount.update({
      where: { id },
      data: {
        deleted: true,
        disconnectedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }
}

export const stripeConnectAccountRepository =
  new StripeConnectAccountRepository();
