import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";

export class MerchantRepository {
  /**
   * Get merchant by tenant ID
   */
  async getByTenantId(tenantId: string) {
    return prisma.merchant.findUnique({
      where: { tenantId },
    });
  }

  /**
   * Get merchant with tenant info by slug
   */
  async getBySlug(slug: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      include: {
        merchant: true,
      },
    });

    return tenant?.merchant || null;
  }

  /**
   * Create a new merchant
   */
  async create(
    tenantId: string,
    data: Omit<Prisma.MerchantCreateInput, "tenant">
  ) {
    return prisma.merchant.create({
      data: {
        ...data,
        tenant: { connect: { id: tenantId } },
      },
    });
  }

  /**
   * Update merchant details
   */
  async update(tenantId: string, data: Prisma.MerchantUpdateInput) {
    return prisma.merchant.update({
      where: { tenantId },
      data,
    });
  }

  /**
   * Check if merchant is currently open
   */
  async isOpen(tenantId: string): Promise<boolean> {
    const merchant = await this.getByTenantId(tenantId);
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
  async getTaxRate(tenantId: string): Promise<number> {
    const merchant = await this.getByTenantId(tenantId);
    return merchant?.taxRate ? Number(merchant.taxRate) : 0;
  }
}

export const merchantRepository = new MerchantRepository();
