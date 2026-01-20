import {
  loyaltyMemberRepository,
  type LoyaltyMemberRepository,
} from "@/repositories/loyalty-member.repository";
import type {
  LoyaltyMemberData,
  LoyaltyStatus,
  CreateMemberInput,
  PaginatedMembers,
} from "./loyalty.types";
import { toLoyaltyMemberData } from "./loyalty.types";

export class LoyaltyMemberService {
  private _repository: LoyaltyMemberRepository | null = null;

  private get repository(): LoyaltyMemberRepository {
    if (!this._repository) {
      this._repository = loyaltyMemberRepository;
    }
    return this._repository;
  }

  /**
   * Get loyalty member by ID
   */
  async getMember(
    tenantId: string,
    memberId: string
  ): Promise<LoyaltyMemberData | null> {
    const member = await this.repository.getById(tenantId, memberId);
    if (!member) return null;
    return toLoyaltyMemberData(member);
  }

  /**
   * Get loyalty member by phone
   */
  async getMemberByPhone(
    tenantId: string,
    companyId: string,
    phone: string
  ): Promise<LoyaltyMemberData | null> {
    const member = await this.repository.getByPhone(tenantId, companyId, phone);
    if (!member) return null;
    return toLoyaltyMemberData(member);
  }

  /**
   * Find or create loyalty member
   */
  async findOrCreateByPhone(
    tenantId: string,
    companyId: string,
    phone: string,
    data?: CreateMemberInput
  ): Promise<{ member: LoyaltyMemberData; isNew: boolean }> {
    const result = await this.repository.findOrCreate(
      tenantId,
      companyId,
      phone,
      data ? { email: data.email, name: data.name } : undefined
    );
    return {
      member: toLoyaltyMemberData(result.member),
      isNew: result.isNew,
    };
  }

  /**
   * Get loyalty status for a member
   */
  async getLoyaltyStatus(
    tenantId: string,
    memberId: string,
    pointsValue: number = 0.01 // Default 1 cent per point
  ): Promise<LoyaltyStatus | null> {
    const member = await this.repository.getById(tenantId, memberId);
    if (!member) return null;

    return {
      memberId: member.id,
      phone: member.phone,
      name: member.name,
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
  async getLoyaltyStatusByPhone(
    tenantId: string,
    companyId: string,
    phone: string,
    pointsValue: number = 0.01
  ): Promise<LoyaltyStatus | null> {
    const member = await this.repository.getByPhone(tenantId, companyId, phone);
    if (!member) return null;

    return {
      memberId: member.id,
      phone: member.phone,
      name: member.name,
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
  async updateMember(
    tenantId: string,
    memberId: string,
    data: { name?: string; email?: string }
  ): Promise<void> {
    await this.repository.update(tenantId, memberId, data);
  }

  /**
   * Update member order stats (called after order completion)
   */
  async updateOrderStats(
    tenantId: string,
    memberId: string,
    orderAmount: number
  ): Promise<void> {
    await this.repository.updateOrderStats(tenantId, memberId, orderAmount);
  }

  /**
   * Get members by company (paginated)
   */
  async getMembersByCompany(
    tenantId: string,
    companyId: string,
    options?: {
      page?: number;
      pageSize?: number;
      search?: string;
    }
  ): Promise<PaginatedMembers> {
    const result = await this.repository.getByCompany(
      tenantId,
      companyId,
      options
    );
    return {
      ...result,
      items: result.items.map(toLoyaltyMemberData),
    };
  }

  /**
   * Get member count for a company
   */
  async getMemberCount(tenantId: string, companyId: string): Promise<number> {
    return this.repository.countByCompany(tenantId, companyId);
  }
}

export const loyaltyMemberService = new LoyaltyMemberService();
