import prisma from "@/lib/db";
import type { DbClient } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { generateEntityId } from "@/lib/id";

export class MerchantRepository {
  /**
   * Get merchant by ID
   */
  async getById(merchantId: string) {
    return prisma.merchant.findUnique({
      where: { id: merchantId, deleted: false },
    });
  }

  /**
   * Get merchant by slug (for public URL routing)
   */
  async getBySlug(slug: string) {
    return prisma.merchant.findFirst({
      where: { slug, deleted: false },
    });
  }

  /**
   * Get merchant by slug with tenant info
   */
  async getBySlugWithTenant(slug: string) {
    return prisma.merchant.findFirst({
      where: { slug, deleted: false },
      include: {
        tenant: true,
      },
    });
  }

  /**
   * Get all merchants for a tenant
   */
  async getByTenantId(tenantId: string) {
    return prisma.merchant.findMany({
      where: { tenantId, deleted: false },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Get active merchants for a tenant
   */
  async getActiveByTenantId(tenantId: string) {
    return prisma.merchant.findMany({
      where: {
        tenantId,
        status: "active",
        deleted: false,
      },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Get merchant by ID with tenant info
   */
  async getByIdWithTenant(merchantId: string) {
    return prisma.merchant.findUnique({
      where: { id: merchantId, deleted: false },
      include: {
        tenant: true,
      },
    });
  }

  /**
   * Get all merchants for a tenant with tenant info
   */
  async getByTenantIdWithTenant(tenantId: string) {
    return prisma.merchant.findMany({
      where: { tenantId, deleted: false },
      orderBy: { name: "asc" },
      include: {
        tenant: true,
      },
    });
  }

  /**
   * Get active merchants for a tenant with tenant info
   */
  async getActiveByTenantIdWithTenant(tenantId: string) {
    return prisma.merchant.findMany({
      where: {
        tenantId,
        status: "active",
        deleted: false,
      },
      orderBy: { name: "asc" },
      include: {
        tenant: true,
      },
    });
  }

  /**
   * Get merchant by AI phone number (normalizes + prefix)
   */
  async getByAiPhone(phone: string) {
    const normalized = phone.startsWith("+") ? phone.slice(1) : phone;
    const withPlus = `+${normalized}`;
    const withoutPlus = normalized;

    return prisma.merchant.findFirst({
      where: {
        OR: [{ aiPhone: withoutPlus }, { aiPhone: withPlus }],
        deleted: false,
      },
      select: {
        id: true,
        tenantId: true,
        slug: true,
        name: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        phone: true,
        email: true,
        timezone: true,
        currency: true,
        locale: true,
        phoneAiSettings: true,
      },
    });
  }

  /**
   * Create a new merchant. Pass an `id` in `data` to reuse a pre-generated
   * identifier (useful when the caller needs the id before persisting — e.g.
   * to return it alongside the paired tenant record in `createTenantWithMerchant`).
   */
  async create(
    tenantId: string,
    data: Omit<Prisma.MerchantCreateInput, "id" | "tenant"> & { id?: string },
    tx?: DbClient
  ) {
    const db = tx ?? prisma;
    const { id, ...rest } = data;
    return db.merchant.create({
      data: {
        id: id ?? generateEntityId(),
        ...rest,
        tenant: { connect: { id: tenantId } },
      },
    });
  }

  /**
   * Update merchant details by ID
   */
  async update(
    merchantId: string,
    data: Prisma.MerchantUpdateInput,
    tx?: DbClient
  ) {
    const db = tx ?? prisma;
    return db.merchant.update({
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
        tenant: true,
      },
    });
  }

  /**
   * Check if merchant slug is available
   */
  async isSlugAvailable(slug: string, excludeMerchantId?: string) {
    const existing = await prisma.merchant.findFirst({
      where: { slug, deleted: false },
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
   * Soft delete merchant
   */
  async delete(merchantId: string) {
    return prisma.merchant.update({
      where: { id: merchantId },
      data: { deleted: true, updatedAt: new Date() },
    });
  }
}

export const merchantRepository = new MerchantRepository();
