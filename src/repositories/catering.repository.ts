import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";

export class CateringRepository {
  /**
   * Create a new catering lead
   */
  async create(
    tenantId: string,
    merchantId: string,
    data: {
      name: string;
      phone: string;
      email: string;
      notes?: string | null;
    }
  ) {
    return prisma.cateringLead.create({
      data: {
        id: crypto.randomUUID(),
        tenantId,
        merchantId,
        name: data.name,
        phone: data.phone,
        email: data.email,
        notes: data.notes,
        status: "pending",
      },
    });
  }

  /**
   * Get leads for a specific merchant with pagination
   */
  async getByMerchant(
    tenantId: string,
    merchantId: string,
    options: {
      page?: number;
      pageSize?: number;
      search?: string;
      status?: string;
    } = {}
  ) {
    const { page = 1, pageSize = 20, search, status } = options;

    const where: Prisma.CateringLeadWhereInput = {
      tenantId,
      merchantId,
    };

    if (status && status !== "all") {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.cateringLead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.cateringLead.count({ where }),
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
   * Get leads for all merchants in a company (for dashboard)
   */
  async getByCompany(
    tenantId: string,
    companyId: string,
    options: {
      page?: number;
      pageSize?: number;
      search?: string;
      status?: string;
      merchantId?: string;
    } = {}
  ) {
    const { page = 1, pageSize = 20, search, status, merchantId } = options;

    const where: Prisma.CateringLeadWhereInput = {
      tenantId,
      merchant: {
        companyId,
      },
    };

    if (merchantId) {
      where.merchantId = merchantId;
    }

    if (status && status !== "all") {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.cateringLead.findMany({
        where,
        include: {
          merchant: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.cateringLead.count({ where }),
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
   * Update lead status
   */
  async updateStatus(tenantId: string, id: string, status: string) {
    return prisma.cateringLead.updateMany({
      where: { id, tenantId },
      data: { status },
    });
  }
}

export const cateringRepository = new CateringRepository();
