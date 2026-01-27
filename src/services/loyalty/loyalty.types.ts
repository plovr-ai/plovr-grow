import type { LoyaltyConfig, LoyaltyMember, PointTransaction } from "@prisma/client";

// ==================== Loyalty Config Types ====================

export interface LoyaltyConfigData {
  id: string;
  tenantId: string;
  companyId: string;
  pointsPerDollar: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertLoyaltyConfigInput {
  pointsPerDollar?: number;
  status?: "active" | "inactive";
}

// ==================== Loyalty Member Types ====================

export interface LoyaltyMemberData {
  id: string;
  tenantId: string;
  companyId: string;
  phone: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  points: number;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: Date | null;
  enrolledAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMemberInput {
  phone: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export interface LoyaltyStatus {
  memberId: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  points: number;
  totalOrders: number;
  totalSpent: number;
  enrolledAt: Date;
  pointsValue: number; // Monetary value of current points (for future redemption)
}

// ==================== Points Types ====================

export interface AwardPointsInput {
  merchantId?: string;
  orderId?: string;
  orderAmount: number;
  pointsPerDollar: number;
  description?: string;
}

/**
 * Input for awarding a custom points amount (e.g., for gift card double points)
 */
export interface AwardCustomPointsInput {
  merchantId?: string;
  orderId?: string;
  points: number;
  description?: string;
}

export interface PointsEarnResult {
  pointsEarned: number;
  newBalance: number;
  transactionId: string;
}

export interface PointTransactionData {
  id: string;
  memberId: string;
  merchantId: string | null;
  orderId: string | null;
  type: string;
  points: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string | null;
  createdAt: Date;
  merchant?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  order?: {
    id: string;
    orderNumber: string;
  } | null;
}

export interface PaginatedTransactions {
  items: PointTransactionData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ==================== Paginated Members ====================

export interface PaginatedMembers {
  items: LoyaltyMemberData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ==================== Utility functions ====================

export function toLoyaltyConfigData(config: LoyaltyConfig): LoyaltyConfigData {
  return {
    id: config.id,
    tenantId: config.tenantId,
    companyId: config.companyId,
    pointsPerDollar: Number(config.pointsPerDollar),
    status: config.status,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

export function toLoyaltyMemberData(member: LoyaltyMember): LoyaltyMemberData {
  return {
    id: member.id,
    tenantId: member.tenantId,
    companyId: member.companyId,
    phone: member.phone,
    email: member.email,
    firstName: member.firstName,
    lastName: member.lastName,
    points: member.points,
    totalOrders: member.totalOrders,
    totalSpent: Number(member.totalSpent),
    lastOrderAt: member.lastOrderAt,
    enrolledAt: member.enrolledAt,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  };
}
