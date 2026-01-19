import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";

export class MerchantRepository {
  /**
   * Get merchant by ID
   */
  async getById(merchantId: string) {
    return prisma.merchant.findUnique({
      where: { id: merchantId },
    });
  }

  /**
   * @deprecated Use getById instead. This method is kept for backward compatibility.
   * Get first merchant by company's tenant ID (for legacy code migration)
   */
  async getByTenantId(tenantId: string) {
    const company = await prisma.company.findUnique({
      where: { tenantId },
      include: {
        merchants: {
          take: 1,
        },
      },
    });
    return company?.merchants[0] || null;
  }

  /**
   * Get merchant by slug (for public URL routing)
   */
  async getBySlug(slug: string) {
    return prisma.merchant.findUnique({
      where: { slug },
    });
  }

  /**
   * Get merchant by slug with company info
   */
  async getBySlugWithCompany(slug: string) {
    return prisma.merchant.findUnique({
      where: { slug },
      include: {
        company: {
          include: {
            tenant: true,
          },
        },
      },
    });
  }

  /**
   * Get all merchants for a company
   */
  async getByCompanyId(companyId: string) {
    return prisma.merchant.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Get active merchants for a company
   */
  async getActiveByCompanyId(companyId: string) {
    return prisma.merchant.findMany({
      where: {
        companyId,
        status: "active",
      },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Get merchant by ID with company info
   */
  async getByIdWithCompany(merchantId: string) {
    return prisma.merchant.findUnique({
      where: { id: merchantId },
      include: {
        company: {
          include: {
            tenant: true,
          },
        },
      },
    });
  }

  /**
   * Get all merchants for a company with company info
   */
  async getByCompanyIdWithCompany(companyId: string) {
    return prisma.merchant.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      include: {
        company: {
          include: {
            tenant: true,
          },
        },
      },
    });
  }

  /**
   * Get active merchants for a company with company info
   */
  async getActiveByCompanyIdWithCompany(companyId: string) {
    return prisma.merchant.findMany({
      where: {
        companyId,
        status: "active",
      },
      orderBy: { name: "asc" },
      include: {
        company: {
          include: {
            tenant: true,
          },
        },
      },
    });
  }

  /**
   * Create a new merchant
   */
  async create(
    companyId: string,
    data: Omit<Prisma.MerchantCreateInput, "id" | "company">
  ) {
    return prisma.merchant.create({
      data: {
        id: crypto.randomUUID(),
        ...data,
        company: { connect: { id: companyId } },
      },
    });
  }

  /**
   * Update merchant details by ID
   */
  async update(merchantId: string, data: Prisma.MerchantUpdateInput) {
    return prisma.merchant.update({
      where: { id: merchantId },
      data,
    });
  }

  /**
   * Update merchant settings (JSON field)
   */
  async updateSettings(merchantId: string, settings: Record<string, unknown>) {
    return prisma.merchant.update({
      where: { id: merchantId },
      data: { settings: settings as Prisma.InputJsonValue },
      include: {
        company: {
          include: {
            tenant: true,
          },
        },
      },
    });
  }

  /**
   * Check if merchant slug is available
   */
  async isSlugAvailable(slug: string, excludeMerchantId?: string) {
    const existing = await prisma.merchant.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing) return true;
    if (excludeMerchantId && existing.id === excludeMerchantId) return true;
    return false;
  }

  /**
   * Check if merchant is currently open
   */
  async isOpen(merchantId: string): Promise<boolean> {
    const merchant = await this.getById(merchantId);
    if (!merchant?.businessHours) return false;

    const hours = merchant.businessHours as Record<
      string,
      { open: string; close: string; closed?: boolean }
    >;

    const now = new Date();
    const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const currentDay = dayNames[now.getDay()];
    const todayHours = hours[currentDay];

    if (!todayHours || todayHours.closed) return false;

    const currentTime = now.toTimeString().slice(0, 5);
    return currentTime >= todayHours.open && currentTime <= todayHours.close;
  }

  /**
   * Get merchant tax rate
   */
  async getTaxRate(merchantId: string): Promise<number> {
    const merchant = await this.getById(merchantId);
    return merchant?.taxRate ? Number(merchant.taxRate) : 0;
  }

  /**
   * Delete merchant
   */
  async delete(merchantId: string) {
    return prisma.merchant.delete({
      where: { id: merchantId },
    });
  }
}

export const merchantRepository = new MerchantRepository();
