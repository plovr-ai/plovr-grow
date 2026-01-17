import { merchantRepository } from "@/repositories/merchant.repository";
import type { Prisma } from "@prisma/client";
import type { UpdateMerchantInput, MerchantStatus } from "@/types/merchant";

// Re-export types for backward compatibility
export type { UpdateMerchantInput } from "@/types/merchant";

export class MerchantService {
  /**
   * Get merchant by ID
   */
  async getMerchant(merchantId: string) {
    return merchantRepository.getById(merchantId);
  }

  /**
   * Get merchant by slug (for public URL access)
   */
  async getMerchantBySlug(slug: string) {
    return merchantRepository.getBySlug(slug);
  }

  /**
   * Get merchant by slug with company and tenant info
   */
  async getMerchantBySlugWithCompany(slug: string) {
    return merchantRepository.getBySlugWithCompany(slug);
  }

  /**
   * Update merchant details
   */
  async updateMerchant(merchantId: string, input: UpdateMerchantInput) {
    const data: Prisma.MerchantUpdateInput = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.address !== undefined) data.address = input.address;
    if (input.city !== undefined) data.city = input.city;
    if (input.state !== undefined) data.state = input.state;
    if (input.zipCode !== undefined) data.zipCode = input.zipCode;
    if (input.country !== undefined) data.country = input.country;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.email !== undefined) data.email = input.email;
    if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl;
    if (input.bannerUrl !== undefined) data.bannerUrl = input.bannerUrl;
    if (input.businessHours !== undefined)
      data.businessHours = input.businessHours as unknown as Prisma.InputJsonValue;
    if (input.timezone !== undefined) data.timezone = input.timezone;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.locale !== undefined) data.locale = input.locale;
    if (input.taxRate !== undefined) data.taxRate = input.taxRate;
    if (input.settings !== undefined)
      data.settings = input.settings as unknown as Prisma.InputJsonValue;
    if (input.status !== undefined) data.status = input.status;

    return merchantRepository.update(merchantId, data);
  }

  /**
   * Update merchant slug
   */
  async updateMerchantSlug(merchantId: string, newSlug: string) {
    const isAvailable = await merchantRepository.isSlugAvailable(
      newSlug,
      merchantId
    );
    if (!isAvailable) {
      throw new Error(`Slug "${newSlug}" is already taken`);
    }

    return merchantRepository.update(merchantId, { slug: newSlug });
  }

  /**
   * Update merchant status
   */
  async updateMerchantStatus(merchantId: string, status: MerchantStatus) {
    return merchantRepository.update(merchantId, { status });
  }

  /**
   * Check if merchant is currently open
   */
  async isOpen(merchantId: string) {
    return merchantRepository.isOpen(merchantId);
  }

  /**
   * Get merchant tax rate
   */
  async getTaxRate(merchantId: string) {
    return merchantRepository.getTaxRate(merchantId);
  }

  /**
   * Delete merchant
   */
  async deleteMerchant(merchantId: string) {
    return merchantRepository.delete(merchantId);
  }
}

export const merchantService = new MerchantService();
