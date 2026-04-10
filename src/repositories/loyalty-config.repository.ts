import prisma from "@/lib/db";
import { generateEntityId } from "@/lib/id";

export class LoyaltyConfigRepository {
  /**
   * Get loyalty config for a company
   */
  async getByTenantId(tenantId: string) {
    return prisma.loyaltyConfig.findFirst({
      where: {
        tenantId,
        deleted: false,
      },
    });
  }

  /**
   * Get loyalty config by ID
   */
  async getById(tenantId: string, id: string) {
    return prisma.loyaltyConfig.findFirst({
      where: {
        id,
        tenantId,
        deleted: false,
      },
    });
  }

  /**
   * Create a new loyalty config
   */
  async create(
    tenantId: string,
    data: {
      pointsPerDollar?: number;
      status?: string;
    }
  ) {
    return prisma.loyaltyConfig.create({
      data: {
        id: generateEntityId(),
        tenantId,
        pointsPerDollar: data.pointsPerDollar ?? 1,
        status: data.status ?? "active",
      },
    });
  }

  /**
   * Update loyalty config
   */
  async update(
    tenantId: string,
    id: string,
    data: {
      pointsPerDollar?: number;
      status?: string;
    }
  ) {
    return prisma.loyaltyConfig.updateMany({
      where: {
        id,
        tenantId,
      },
      data,
    });
  }

  /**
   * Upsert loyalty config (create or update)
   */
  async upsert(
    tenantId: string,
    data: {
      pointsPerDollar?: number;
      status?: string;
    }
  ) {
    return prisma.loyaltyConfig.upsert({
      where: {
        tenantId,
      },
      update: {
        pointsPerDollar: data.pointsPerDollar,
        status: data.status,
      },
      create: {
        id: generateEntityId(),
        tenantId,
        pointsPerDollar: data.pointsPerDollar ?? 1,
        status: data.status ?? "active",
      },
    });
  }

  /**
   * Set loyalty status (enable/disable)
   */
  async setStatus(tenantId: string, status: "active" | "inactive") {
    return prisma.loyaltyConfig.updateMany({
      where: {
        tenantId,
      },
      data: {
        status,
      },
    });
  }
}

export const loyaltyConfigRepository = new LoyaltyConfigRepository();
