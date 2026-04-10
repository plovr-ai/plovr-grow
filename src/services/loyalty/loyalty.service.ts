import { loyaltyConfigService } from "./loyalty-config.service";
import { loyaltyMemberService } from "./loyalty-member.service";
import { pointsService } from "./points.service";
import type {
  LoyaltyConfigData,
  LoyaltyMemberData,
  LoyaltyStatus,
  PointsEarnResult,
} from "./loyalty.types";

export interface OrderCompletionData {
  merchantId: string;
  customerPhone: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerEmail?: string;
  totalAmount: number;
}

export interface CustomerLoyaltyDashboard {
  member: LoyaltyMemberData | null;
  config: LoyaltyConfigData | null;
  isEnabled: boolean;
}

export class LoyaltyService {
  /**
   * Process loyalty for a completed order
   * Called when order status changes to 'completed'
   */
  async processOrderCompletion(
    tenantId: string,
    orderId: string,
    data: OrderCompletionData
  ): Promise<PointsEarnResult | null> {
    // Check if loyalty is enabled
    const isEnabled = await loyaltyConfigService.isLoyaltyEnabled(
      tenantId
    );
    if (!isEnabled) {
      return null;
    }

    // Check if points already awarded
    const alreadyAwarded = await pointsService.hasEarnedForOrder(
      tenantId,
      orderId
    );
    if (alreadyAwarded) {
      return null;
    }

    // Get points per dollar config
    const pointsPerDollar = await loyaltyConfigService.getPointsPerDollar(
      tenantId
    );

    // Find or create member
    const { member } = await loyaltyMemberService.findOrCreateByPhone(
      tenantId,
      data.customerPhone,
      {
        phone: data.customerPhone,
        firstName: data.customerFirstName,
        lastName: data.customerLastName,
        email: data.customerEmail,
      }
    );

    // Award points
    const result = await pointsService.awardPoints(tenantId, member.id, {
      merchantId: data.merchantId,
      orderId,
      orderAmount: data.totalAmount,
      pointsPerDollar,
      description: `Earned from order`,
    });

    // Update member order stats
    await loyaltyMemberService.updateOrderStats(
      tenantId,
      member.id,
      data.totalAmount
    );

    return result;
  }

  /**
   * Get customer loyalty dashboard data (for storefront)
   */
  async getCustomerDashboard(
    tenantId: string,
    phone: string
  ): Promise<CustomerLoyaltyDashboard> {
    const [config, member] = await Promise.all([
      loyaltyConfigService.getLoyaltyConfig(tenantId),
      loyaltyMemberService.getMemberByPhone(tenantId, phone),
    ]);

    return {
      member,
      config,
      isEnabled: config?.status === "active",
    };
  }

  /**
   * Check if loyalty is enabled for a company
   */
  async isLoyaltyEnabled(tenantId: string): Promise<boolean> {
    return loyaltyConfigService.isLoyaltyEnabled(tenantId);
  }

  /**
   * Get loyalty status for a customer
   */
  async getCustomerLoyaltyStatus(
    tenantId: string,
    phone: string
  ): Promise<LoyaltyStatus | null> {
    return loyaltyMemberService.getLoyaltyStatusByPhone(
      tenantId,
      phone
    );
  }

  /**
   * Enroll a customer in loyalty program
   */
  async enrollCustomer(
    tenantId: string,
    phone: string,
    data?: { firstName?: string; lastName?: string; email?: string }
  ): Promise<{ member: LoyaltyMemberData; isNew: boolean }> {
    return loyaltyMemberService.findOrCreateByPhone(
      tenantId,
      phone,
      data ? { phone, firstName: data.firstName, lastName: data.lastName, email: data.email } : undefined
    );
  }
}

export const loyaltyService = new LoyaltyService();
