import prisma from "@/lib/db";
import { generateEntityId } from "@/lib/id";

export interface CreateStripeCustomerInput {
  companyId: string;
  loyaltyMemberId: string;
  stripeCustomerId: string;
}

export class StripeCustomerRepository {
  /**
   * Create a new Stripe customer mapping
   */
  async create(tenantId: string, data: CreateStripeCustomerInput) {
    return prisma.stripeCustomer.create({
      data: {
        id: generateEntityId(),
        tenantId,
        companyId: data.companyId,
        loyaltyMemberId: data.loyaltyMemberId,
        stripeCustomerId: data.stripeCustomerId,
      },
    });
  }

  /**
   * Get Stripe customer by loyalty member ID
   */
  async getByLoyaltyMemberId(loyaltyMemberId: string) {
    return prisma.stripeCustomer.findUnique({
      where: {
        loyaltyMemberId,
      },
    });
  }

  /**
   * Get Stripe customer by Stripe customer ID
   */
  async getByStripeCustomerId(stripeCustomerId: string) {
    return prisma.stripeCustomer.findUnique({
      where: {
        stripeCustomerId,
      },
    });
  }

  /**
   * Get Stripe customer with loyalty member details
   */
  async getWithMemberByLoyaltyMemberId(loyaltyMemberId: string) {
    return prisma.stripeCustomer.findUnique({
      where: {
        loyaltyMemberId,
      },
      include: {
        loyaltyMember: {
          select: {
            id: true,
            phone: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Delete Stripe customer mapping
   */
  async delete(id: string) {
    return prisma.stripeCustomer.delete({
      where: { id },
    });
  }

  /**
   * Delete Stripe customer mapping by loyalty member ID
   */
  async deleteByLoyaltyMemberId(loyaltyMemberId: string) {
    return prisma.stripeCustomer.delete({
      where: { loyaltyMemberId },
    });
  }
}

export const stripeCustomerRepository = new StripeCustomerRepository();
