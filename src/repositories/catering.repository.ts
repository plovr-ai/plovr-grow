import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { generateEntityId } from "@/lib/id";

export class CateringRepository {
  /**
   * Create a new catering lead
   */
  async create(
    tenantId: string,
    merchantId: string,
    data: {
      firstName: string;
      lastName: string;
      phone: string;
      email: string;
      notes?: string | null;
    }
  ) {
    return prisma.cateringLead.create({
      data: {
        id: generateEntityId(),
        tenantId,
        merchantId,
        firstName: data.firstName,
        lastName: data.lastName,
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
        { firstName: { contains: search } },
        { lastName: { contains: search } },
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
        { firstName: { contains: search } },
        { lastName: { contains: search } },
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

  /**
   * Get a single lead by ID
   */
  async getById(tenantId: string, leadId: string) {
    return prisma.cateringLead.findFirst({
      where: { id: leadId, tenantId },
      include: {
        merchant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }
}

export const cateringRepository = new CateringRepository();
