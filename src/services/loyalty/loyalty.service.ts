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
  /** Amount paid via gift card — earns 2x loyalty points */
  giftCardPayment?: number;
  /** Pre-resolved loyalty member ID (skips phone-based lookup when present) */
  loyaltyMemberId?: string;
}

export interface CustomerLoyaltyDashboard {
  member: LoyaltyMemberData | null;
  config: LoyaltyConfigData | null;
  isEnabled: boolean;
}

/**
 * Process loyalty for a completed order
 * Called when order status changes to 'completed'
 */
async function processOrderCompletion(
  tenantId: string,
  orderId: string,
  data: OrderCompletionData
): Promise<PointsEarnResult | null> {
  // Check if loyalty is enabled
  const isEnabled = await loyaltyConfigService.isLoyaltyEnabled(tenantId);
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
  const pointsPerDollar = await loyaltyConfigService.getPointsPerDollar(tenantId);

  // Resolve member: use pre-resolved ID if available, otherwise lookup by phone
  let memberId: string;
  if (data.loyaltyMemberId) {
    memberId = data.loyaltyMemberId;
  } else {
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
    memberId = member.id;
  }

  // Calculate points — gift card portion earns 2x
  const giftCardPortion = data.giftCardPayment ?? 0;
  const cashPortion = Math.max(0, data.totalAmount - giftCardPortion);
  const hasGiftCard = giftCardPortion > 0;

  let result: PointsEarnResult;

  if (hasGiftCard) {
    const giftCardPoints = Math.floor(giftCardPortion * pointsPerDollar * 2);
    const cashPoints = Math.floor(cashPortion * pointsPerDollar);
    const totalPoints = giftCardPoints + cashPoints;

    if (totalPoints <= 0) {
      return null;
    }

    // Build description
    let description = `Earned from order`;
    if (giftCardPortion > 0 && cashPortion > 0) {
      description += ` (${giftCardPoints} pts from gift card at 2x, ${cashPoints} pts from cash)`;
    } else {
      description += ` (2x bonus on gift card payment)`;
    }

    result = await pointsService.awardPointsWithCustomAmount(tenantId, memberId, {
      merchantId: data.merchantId,
      orderId,
      points: totalPoints,
      description,
    });
  } else {
    // Standard points calculation (no gift card)
    result = await pointsService.awardPoints(tenantId, memberId, {
      merchantId: data.merchantId,
      orderId,
      orderAmount: data.totalAmount,
      pointsPerDollar,
      description: `Earned from order`,
    });
  }

  // Update member order stats
  await loyaltyMemberService.updateOrderStats(
    tenantId,
    memberId,
    data.totalAmount
  );

  return result;
}

/**
 * Get customer loyalty dashboard data (for storefront)
 */
async function getCustomerDashboard(
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
async function isLoyaltyEnabled(tenantId: string): Promise<boolean> {
  return loyaltyConfigService.isLoyaltyEnabled(tenantId);
}

/**
 * Get loyalty status for a customer
 */
async function getCustomerLoyaltyStatus(
  tenantId: string,
  phone: string
): Promise<LoyaltyStatus | null> {
  return loyaltyMemberService.getLoyaltyStatusByPhone(tenantId, phone);
}

/**
 * Enroll a customer in loyalty program
 */
async function enrollCustomer(
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

export const loyaltyService = {
  processOrderCompletion,
  getCustomerDashboard,
  isLoyaltyEnabled,
  getCustomerLoyaltyStatus,
  enrollCustomer,
};
