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
  customerName?: string;
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
    companyId: string,
    orderId: string,
    data: OrderCompletionData
  ): Promise<PointsEarnResult | null> {
    // Check if loyalty is enabled
    const isEnabled = await loyaltyConfigService.isLoyaltyEnabled(
      tenantId,
      companyId
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
      tenantId,
      companyId
    );

    // Find or create member
    const { member } = await loyaltyMemberService.findOrCreateByPhone(
      tenantId,
      companyId,
      data.customerPhone,
      {
        phone: data.customerPhone,
        name: data.customerName,
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
    companyId: string,
    phone: string
  ): Promise<CustomerLoyaltyDashboard> {
    const [config, member] = await Promise.all([
      loyaltyConfigService.getLoyaltyConfig(tenantId, companyId),
      loyaltyMemberService.getMemberByPhone(tenantId, companyId, phone),
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
  async isLoyaltyEnabled(tenantId: string, companyId: string): Promise<boolean> {
    return loyaltyConfigService.isLoyaltyEnabled(tenantId, companyId);
  }

  /**
   * Get loyalty status for a customer
   */
  async getCustomerLoyaltyStatus(
    tenantId: string,
    companyId: string,
    phone: string
  ): Promise<LoyaltyStatus | null> {
    return loyaltyMemberService.getLoyaltyStatusByPhone(
      tenantId,
      companyId,
      phone
    );
  }

  /**
   * Enroll a customer in loyalty program
   */
  async enrollCustomer(
    tenantId: string,
    companyId: string,
    phone: string,
    data?: { name?: string; email?: string }
  ): Promise<{ member: LoyaltyMemberData; isNew: boolean }> {
    return loyaltyMemberService.findOrCreateByPhone(
      tenantId,
      companyId,
      phone,
      data ? { phone, name: data.name, email: data.email } : undefined
    );
  }
}

export const loyaltyService = new LoyaltyService();
