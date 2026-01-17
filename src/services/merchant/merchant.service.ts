// ==================== Merchant Service ====================
// Currently uses mock data. Will be replaced with Repository layer later.

import {
  getMockMerchantBySlug,
  getMockMerchantById,
  getMockCompanyBySlug,
  getMockMerchantsByCompanyId,
  isMockSlugAvailable,
} from "./merchant.mock";
import type { MerchantWithCompany, CompanyWithMerchants } from "./merchant.types";

// Re-export types
export type { MerchantWithCompany, CompanyWithMerchants } from "./merchant.types";

export class MerchantService {
  /**
   * Get merchant by ID
   */
  async getMerchant(merchantId: string): Promise<MerchantWithCompany | null> {
    // TODO: Replace with merchantRepository.getById(merchantId)
    return getMockMerchantById(merchantId);
  }

  /**
   * Get merchant by slug (for public URL access)
   */
  async getMerchantBySlug(slug: string): Promise<MerchantWithCompany | null> {
    // TODO: Replace with merchantRepository.getBySlug(slug)
    return getMockMerchantBySlug(slug);
  }

  /**
   * Get merchant by slug with company and tenant info
   * Alias for getMerchantBySlug (mock data already includes company)
   */
  async getMerchantBySlugWithCompany(slug: string): Promise<MerchantWithCompany | null> {
    // TODO: Replace with merchantRepository.getBySlugWithCompany(slug)
    return getMockMerchantBySlug(slug);
  }

  /**
   * Get company by slug with all merchants
   */
  async getCompanyBySlug(slug: string): Promise<CompanyWithMerchants | null> {
    // TODO: Replace with companyRepository.getBySlug(slug)
    return getMockCompanyBySlug(slug);
  }

  /**
   * Get all merchants for a company
   */
  async getMerchantsByCompanyId(companyId: string): Promise<MerchantWithCompany[]> {
    // TODO: Replace with merchantRepository.getByCompanyId(companyId)
    return getMockMerchantsByCompanyId(companyId);
  }

  /**
   * Check if a slug is available
   */
  async isSlugAvailable(slug: string, excludeMerchantId?: string): Promise<boolean> {
    // TODO: Replace with merchantRepository.isSlugAvailable(slug, excludeMerchantId)
    return isMockSlugAvailable(slug, excludeMerchantId);
  }

  /**
   * Get merchant tax rate
   */
  async getTaxRate(merchantId: string): Promise<number> {
    // TODO: Replace with merchantRepository.getTaxRate(merchantId)
    const merchant = getMockMerchantById(merchantId);
    return merchant?.taxRate ?? 0;
  }

  /**
   * Check if merchant is currently open
   * TODO: Implement based on businessHours when available
   */
  async isOpen(merchantId: string): Promise<boolean> {
    const merchant = getMockMerchantById(merchantId);
    if (!merchant) return false;
    // For now, just check if merchant is active
    return merchant.status === "active";
  }
}

export const merchantService = new MerchantService();
