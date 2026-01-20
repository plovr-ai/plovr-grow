import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";

export class LoyaltyMemberRepository {
  /**
   * Get loyalty member by ID
   */
  async getById(tenantId: string, id: string) {
    return prisma.loyaltyMember.findFirst({
      where: {
        id,
        tenantId,
      },
    });
  }

  /**
   * Get loyalty member by phone (within a company)
   */
  async getByPhone(tenantId: string, companyId: string, phone: string) {
    return prisma.loyaltyMember.findFirst({
      where: {
        tenantId,
        companyId,
        phone,
      },
    });
  }

  /**
   * Create a new loyalty member
   */
  async create(
    tenantId: string,
    companyId: string,
    data: {
      phone: string;
      email?: string | null;
      name?: string | null;
    }
  ) {
    return prisma.loyaltyMember.create({
      data: {
        id: crypto.randomUUID(),
        tenantId,
        companyId,
        phone: data.phone,
        email: data.email,
        name: data.name,
      },
    });
  }

  /**
   * Update loyalty member
   */
  async update(
    tenantId: string,
    id: string,
    data: Prisma.LoyaltyMemberUpdateInput
  ) {
    return prisma.loyaltyMember.updateMany({
      where: {
        id,
        tenantId,
      },
      data,
    });
  }

  /**
   * Update points balance
   */
  async updatePoints(tenantId: string, id: string, pointsDelta: number) {
    return prisma.loyaltyMember.update({
      where: {
        id,
        tenantId,
      },
      data: {
        points: { increment: pointsDelta },
      },
    });
  }

  /**
   * Update order stats (after order completion)
   */
  async updateOrderStats(
    tenantId: string,
    id: string,
    orderAmount: number
  ) {
    return prisma.loyaltyMember.update({
      where: {
        id,
        tenantId,
      },
      data: {
        totalOrders: { increment: 1 },
        totalSpent: { increment: orderAmount },
        lastOrderAt: new Date(),
      },
    });
  }

  /**
   * Find or create loyalty member
   */
  async findOrCreate(
    tenantId: string,
    companyId: string,
    phone: string,
    data?: {
      email?: string | null;
      name?: string | null;
    }
  ) {
    const existing = await this.getByPhone(tenantId, companyId, phone);
    if (existing) {
      return { member: existing, isNew: false };
    }

    const member = await this.create(tenantId, companyId, {
      phone,
      email: data?.email,
      name: data?.name,
    });
    return { member, isNew: true };
  }

  /**
   * Get members by company with pagination
   */
  async getByCompany(
    tenantId: string,
    companyId: string,
    options: {
      page?: number;
      pageSize?: number;
      search?: string;
    } = {}
  ) {
    const { page = 1, pageSize = 20, search } = options;

    const where: Prisma.LoyaltyMemberWhereInput = {
      tenantId,
      companyId,
    };

    if (search) {
      where.OR = [
        { phone: { contains: search } },
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.loyaltyMember.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.loyaltyMember.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get member count for a company
   */
  async countByCompany(tenantId: string, companyId: string) {
    return prisma.loyaltyMember.count({
      where: {
        tenantId,
        companyId,
      },
    });
  }
}

export const loyaltyMemberRepository = new LoyaltyMemberRepository();
