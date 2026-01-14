import { merchantRepository } from "@/repositories/merchant.repository";
import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface CreateTenantInput {
  name: string;
  slug: string;
  merchantName: string;
  merchantAddress?: string;
  merchantCity?: string;
  merchantState?: string;
  merchantZipCode?: string;
  merchantPhone?: string;
  merchantEmail?: string;
}

export interface UpdateMerchantInput {
  name?: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  bannerUrl?: string;
  businessHours?: Record<
    string,
    { open: string; close: string; closed?: boolean }
  >;
  timezone?: string;
  taxRate?: number;
  settings?: Record<string, unknown>;
}

export class MerchantService {
  /**
   * Create a new tenant with merchant
   */
  async createTenant(input: CreateTenantInput) {
    return prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: input.name,
          slug: input.slug,
        },
      });

      // Create merchant
      const merchant = await tx.merchant.create({
        data: {
          tenantId: tenant.id,
          name: input.merchantName,
          address: input.merchantAddress,
          city: input.merchantCity,
          state: input.merchantState,
          zipCode: input.merchantZipCode,
          phone: input.merchantPhone,
          email: input.merchantEmail,
        },
      });

      return { tenant, merchant };
    });
  }

  /**
   * Get merchant by tenant ID
   */
  async getMerchant(tenantId: string) {
    return merchantRepository.getByTenantId(tenantId);
  }

  /**
   * Get merchant by slug (for public access)
   */
  async getMerchantBySlug(slug: string) {
    return merchantRepository.getBySlug(slug);
  }

  /**
   * Update merchant details
   */
  async updateMerchant(tenantId: string, input: UpdateMerchantInput) {
    const data: Prisma.MerchantUpdateInput = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.address !== undefined) data.address = input.address;
    if (input.city !== undefined) data.city = input.city;
    if (input.state !== undefined) data.state = input.state;
    if (input.zipCode !== undefined) data.zipCode = input.zipCode;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.email !== undefined) data.email = input.email;
    if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl;
    if (input.bannerUrl !== undefined) data.bannerUrl = input.bannerUrl;
    if (input.businessHours !== undefined)
      data.businessHours = input.businessHours;
    if (input.timezone !== undefined) data.timezone = input.timezone;
    if (input.taxRate !== undefined) data.taxRate = input.taxRate;
    if (input.settings !== undefined)
      data.settings = input.settings as Prisma.InputJsonValue;

    return merchantRepository.update(tenantId, data);
  }

  /**
   * Check if merchant is currently open
   */
  async isOpen(tenantId: string) {
    return merchantRepository.isOpen(tenantId);
  }

  /**
   * Get tenant by slug
   */
  async getTenantBySlug(slug: string) {
    return prisma.tenant.findUnique({
      where: { slug },
      include: {
        merchant: true,
      },
    });
  }
}

export const merchantService = new MerchantService();
