import { loyaltyMemberRepository } from "@/repositories/loyalty-member.repository";
import type {
  LoyaltyMemberData,
  LoyaltyStatus,
  CreateMemberInput,
  PaginatedMembers,
} from "./loyalty.types";
import { toLoyaltyMemberData } from "./loyalty.types";

/**
 * Get loyalty member by ID
 */
async function getMember(
  tenantId: string,
  memberId: string
): Promise<LoyaltyMemberData | null> {
  const member = await loyaltyMemberRepository.getById(tenantId, memberId);
  if (!member) return null;
  return toLoyaltyMemberData(member);
}

/**
 * Get loyalty member by phone
 */
async function getMemberByPhone(
  tenantId: string,
  phone: string
): Promise<LoyaltyMemberData | null> {
  const member = await loyaltyMemberRepository.getByPhone(tenantId, phone);
  if (!member) return null;
  return toLoyaltyMemberData(member);
}

/**
 * Find or create loyalty member
 */
async function findOrCreateByPhone(
  tenantId: string,
  phone: string,
  data?: CreateMemberInput
): Promise<{ member: LoyaltyMemberData; isNew: boolean }> {
  const result = await loyaltyMemberRepository.findOrCreate(
    tenantId,
    phone,
    data ? { email: data.email, firstName: data.firstName, lastName: data.lastName } : undefined
  );
  return {
    member: toLoyaltyMemberData(result.member),
    isNew: result.isNew,
  };
}

/**
 * Get loyalty status for a member
 */
async function getLoyaltyStatus(
  tenantId: string,
  memberId: string,
  pointsValue: number = 0.01 // Default 1 cent per point
): Promise<LoyaltyStatus | null> {
  const member = await loyaltyMemberRepository.getById(tenantId, memberId);
  if (!member) return null;

  return {
    memberId: member.id,
    phone: member.phone,
    firstName: member.firstName,
    lastName: member.lastName,
    points: member.points,
    totalOrders: member.totalOrders,
    totalSpent: Number(member.totalSpent),
    enrolledAt: member.enrolledAt,
    pointsValue: member.points * pointsValue,
  };
}

/**
 * Get loyalty status by phone
 */
async function getLoyaltyStatusByPhone(
  tenantId: string,
  phone: string,
  pointsValue: number = 0.01
): Promise<LoyaltyStatus | null> {
  const member = await loyaltyMemberRepository.getByPhone(tenantId, phone);
  if (!member) return null;

  return {
    memberId: member.id,
    phone: member.phone,
    firstName: member.firstName,
    lastName: member.lastName,
    points: member.points,
    totalOrders: member.totalOrders,
    totalSpent: Number(member.totalSpent),
    enrolledAt: member.enrolledAt,
    pointsValue: member.points * pointsValue,
  };
}

/**
 * Update member profile
 */
async function updateMember(
  tenantId: string,
  memberId: string,
  data: { firstName?: string; lastName?: string; email?: string }
): Promise<void> {
  await loyaltyMemberRepository.update(tenantId, memberId, data);
}

/**
 * Update member order stats (called after order completion)
 */
async function updateOrderStats(
  tenantId: string,
  memberId: string,
  orderAmount: number
): Promise<void> {
  await loyaltyMemberRepository.updateOrderStats(tenantId, memberId, orderAmount);
}

/**
 * Get members by company (paginated)
 */
async function getMembersByTenant(
  tenantId: string,
  options?: {
    page?: number;
    pageSize?: number;
    search?: string;
  }
): Promise<PaginatedMembers> {
  const result = await loyaltyMemberRepository.getByTenant(tenantId, options);
  return {
    ...result,
    items: result.items.map(toLoyaltyMemberData),
  };
}

/**
 * Get member count for a company
 */
async function getMemberCount(tenantId: string): Promise<number> {
  return loyaltyMemberRepository.countByTenant(tenantId);
}

export const loyaltyMemberService = {
  getMember,
  getMemberByPhone,
  findOrCreateByPhone,
  getLoyaltyStatus,
  getLoyaltyStatusByPhone,
  updateMember,
  updateOrderStats,
  getMembersByTenant,
  getMemberCount,
};
