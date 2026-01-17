import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";

export class CompanyRepository {
  /**
   * Get company by ID
   */
  async getById(companyId: string) {
    return prisma.company.findUnique({
      where: { id: companyId },
    });
  }

  /**
   * Get company by tenant ID
   */
  async getByTenantId(tenantId: string) {
    return prisma.company.findUnique({
      where: { tenantId },
    });
  }

  /**
   * Get company with all merchants
   */
  async getWithMerchants(companyId: string) {
    return prisma.company.findUnique({
      where: { id: companyId },
      include: {
        merchants: {
          orderBy: { name: "asc" },
        },
      },
    });
  }

  /**
   * Get company with tenant info
   */
  async getWithTenant(companyId: string) {
    return prisma.company.findUnique({
      where: { id: companyId },
      include: {
        tenant: true,
      },
    });
  }

  /**
   * Create a new company
   */
  async create(
    tenantId: string,
    data: Omit<Prisma.CompanyCreateInput, "tenant">
  ) {
    return prisma.company.create({
      data: {
        ...data,
        tenant: { connect: { id: tenantId } },
      },
    });
  }

  /**
   * Update company details
   */
  async update(companyId: string, data: Prisma.CompanyUpdateInput) {
    return prisma.company.update({
      where: { id: companyId },
      data,
    });
  }

  /**
   * Delete company (cascades to merchants)
   */
  async delete(companyId: string) {
    return prisma.company.delete({
      where: { id: companyId },
    });
  }
}

export const companyRepository = new CompanyRepository();
