// ==================== Merchant Service ====================
// 商户服务层 - 封装商户相关业务逻辑

import { merchantRepository } from "@/repositories/merchant.repository";
import { tenantRepository } from "@/repositories/tenant.repository";
import { menuService } from "@/services/menu";
import { toMerchantWithTenant, toTenantWithMerchants } from "./merchant.mapper";
import { AppError, ErrorCodes } from "@/lib/errors";
import type { Prisma } from "@prisma/client";
import type {
  MerchantWithTenant,
  TenantWithMerchants,
  CreateMerchantInput,
  UpdateMerchantInput,
  UpdateMerchantSettingsInput,
  GetMerchantsFilter,
  WebsiteMerchantData,
} from "./merchant.types";
import type { SocialLink, TenantSettings } from "@/types/tenant";
import type { MerchantSettings } from "@/types/merchant";

export class MerchantService {
  // ==================== 公开查询方法 (Storefront) ====================

  /**
   * 通过 Slug 获取 Merchant (公开访问，无需认证)
   * 用于 Storefront 页面
   */
  async getMerchantBySlug(slug: string): Promise<MerchantWithTenant | null> {
    const data = await merchantRepository.getBySlugWithTenant(slug);
    if (!data) return null;
    return toMerchantWithTenant(data);
  }

  /**
   * 通过 Slug 获取 Merchant (别名，保持向后兼容)
   */
  async getMerchantBySlugWithTenant(
    slug: string
  ): Promise<MerchantWithTenant | null> {
    return this.getMerchantBySlug(slug);
  }

  /**
   * 通过 ID 获取 Merchant (公开访问，无需认证)
   * 用于 API routes 中需要从 merchantId 反查 tenantId 的场景
   */
  async getMerchantById(merchantId: string): Promise<MerchantWithTenant | null> {
    const data = await merchantRepository.getByIdWithTenant(merchantId);
    if (!data) return null;
    return toMerchantWithTenant(data);
  }

  /**
   * 通过 Slug 获取 Company 及其所有 Merchants (公开访问)
   * 用于品牌官网门店列表
   */
  async getTenantBySlug(slug: string): Promise<TenantWithMerchants | null> {
    const data = await tenantRepository.getBySlugWithMerchants(slug);
    if (!data) return null;
    return toTenantWithMerchants(data);
  }

  /**
   * 获取网站显示数据 (公开访问)
   * 合并 Company 和 Merchant 数据用于网站模板渲染
   * @param merchantSlug - Merchant slug
   */
  async getWebsiteData(merchantSlug: string): Promise<WebsiteMerchantData | null> {
    const merchant = await this.getMerchantBySlug(merchantSlug);
    if (!merchant) return null;

    const tenantSettings = merchant.tenant.settings as TenantSettings | undefined;
    const merchantSettings = merchant.settings as MerchantSettings | undefined;

    // Merchant-level website config can override tenant-level
    const tenantWebsite = tenantSettings?.website;
    const merchantWebsite = merchantSettings?.website;

    // Build website data with fallback chain: Merchant -> Tenant -> Default
    const websiteData: WebsiteMerchantData = {
      name: merchant.tenant.name,
      tagline: merchantWebsite?.tagline || tenantWebsite?.tagline || "",
      address: merchant.address || "",
      city: merchant.city || "",
      state: merchant.state || "",
      zipCode: merchant.zipCode || "",
      phone: merchant.phone || "",
      email: merchant.email || "",
      logo: merchant.logoUrl || merchant.tenant.logoUrl || "",
      heroImage: merchantWebsite?.heroImage || tenantWebsite?.heroImage || merchant.bannerUrl || "",
      businessHours: merchant.businessHours || {},
      socialLinks: tenantWebsite?.socialLinks || ([] as SocialLink[]),
      currency: merchant.currency,
      locale: merchant.locale,
      tipConfig: merchantSettings?.tipConfig,
      feeConfig: merchantSettings?.feeConfig,
    };

    return websiteData;
  }

  /**
   * 获取 Company 网站显示数据 (公开访问)
   * 用于品牌官网首页
   * @param companySlug - Company slug
   */
  async getTenantWebsiteData(companySlug: string): Promise<WebsiteMerchantData | null> {
    const tenant = await this.getTenantBySlug(companySlug);
    if (!tenant) return null;

    const tenantSettings = tenant.settings as TenantSettings | undefined;
    const tenantWebsite = tenantSettings?.website;

    // Fetch featured items from the dedicated featured_items table
    let featuredItems: WebsiteMerchantData["featuredItems"] = [];
    const featuredItemsData = await menuService.getFeaturedItems(
      tenant.tenantId
    );

    if (featuredItemsData.length > 0) {
      // Filter only active items
      featuredItems = featuredItemsData
        .filter((fi) => fi.menuItem.status === "active")
        .map((fi) => ({
          id: fi.id,
          name: fi.menuItem.name,
          description: fi.menuItem.description || "",
          price: fi.menuItem.price,
          image: fi.menuItem.imageUrl || "",
          category: undefined, // Category info not needed for display
          menuItemId: fi.menuItemId,
          hasModifiers: false, // Would need to fetch options separately if needed
        }));
    }

    // For single-merchant tenants, include merchant contact info and business hours
    // For multi-merchant tenants, leave these empty (Footer will hide these sections)
    const singleMerchant = tenant.merchants.length === 1 ? tenant.merchants[0] : null;

    const websiteData: WebsiteMerchantData = {
      name: tenant.name,
      tagline: tenantWebsite?.tagline || tenant.description || "",
      address: singleMerchant?.address || "",
      city: singleMerchant?.city || "",
      state: singleMerchant?.state || "",
      zipCode: singleMerchant?.zipCode || "",
      phone: singleMerchant?.phone || "",
      email: singleMerchant?.email || "",
      logo: tenant.logoUrl || "",
      heroImage: tenantWebsite?.heroImage || "",
      businessHours: singleMerchant?.businessHours || {},
      socialLinks: tenantWebsite?.socialLinks || ([] as SocialLink[]),
      currency: tenantSettings?.defaultCurrency || "USD",
      locale: tenantSettings?.defaultLocale || "en-US",
      featuredItems,
      reviews: tenantWebsite?.reviews || [],
    };

    return websiteData;
  }

  // ==================== 受保护查询方法 (Dashboard/Admin) ====================

  /**
   * 通过 ID 获取 Merchant
   * @param tenantId - 租户 ID (用于权限校验)
   * @param merchantId - 商户 ID
   */
  async getMerchant(
    tenantId: string,
    merchantId: string
  ): Promise<MerchantWithTenant | null> {
    const data = await merchantRepository.getByIdWithTenant(merchantId);
    if (!data) return null;

    // 验证 tenant 隔离
    if (data.tenantId !== tenantId) {
      return null;
    }

    return toMerchantWithTenant(data);
  }

  /**
   * 获取 Tenant 下所有 Merchants
   * @param tenantId - 租户 ID
   * @param filter - 过滤条件
   */
  async getMerchantsByTenantId(
    tenantId: string,
    filter?: GetMerchantsFilter
  ): Promise<MerchantWithTenant[]> {
    const merchants = filter?.status === "active"
      ? await merchantRepository.getActiveByTenantIdWithTenant(tenantId)
      : await merchantRepository.getByTenantIdWithTenant(tenantId);

    return merchants.map(toMerchantWithTenant);
  }

  // ==================== 写入方法 ====================

  /**
   * 创建 Merchant
   * @param tenantId - 租户 ID
   * @param input - 创建参数
   */
  async createMerchant(
    tenantId: string,
    input: CreateMerchantInput
  ): Promise<MerchantWithTenant> {
    // 验证 tenant 存在
    const tenant = await tenantRepository.getById(tenantId);
    if (!tenant) {
      throw new AppError(ErrorCodes.TENANT_NOT_FOUND, undefined, 404);
    }

    // 验证 slug 可用
    const isAvailable = await merchantRepository.isSlugAvailable(input.slug);
    if (!isAvailable) {
      throw new AppError(ErrorCodes.MERCHANT_SLUG_TAKEN, { slug: input.slug }, 409);
    }

    const merchant = await merchantRepository.create(tenantId, {
      slug: input.slug,
      name: input.name,
      description: input.description,
      address: input.address,
      city: input.city,
      state: input.state,
      zipCode: input.zipCode,
      country: input.country ?? "US",
      phone: input.phone,
      email: input.email,
      logoUrl: input.logoUrl,
      bannerUrl: input.bannerUrl,
      businessHours: input.businessHours as unknown as Prisma.InputJsonValue,
      timezone: input.timezone ?? "America/New_York",
      currency: input.currency ?? "USD",
      locale: input.locale ?? "en-US",
      settings: input.settings as unknown as Prisma.InputJsonValue,
    });

    const data = await merchantRepository.getByIdWithTenant(merchant.id);
    return toMerchantWithTenant(data!);
  }

  /**
   * 更新 Merchant
   * @param tenantId - 租户 ID
   * @param merchantId - 商户 ID
   * @param input - 更新参数
   */
  async updateMerchant(
    tenantId: string,
    merchantId: string,
    input: UpdateMerchantInput
  ): Promise<MerchantWithTenant> {
    // 验证权限
    const existing = await this.getMerchant(tenantId, merchantId);
    if (!existing) {
      throw new AppError(ErrorCodes.MERCHANT_NOT_FOUND, undefined, 404);
    }

    // Slug 变更检查
    if (input.slug && input.slug !== existing.slug) {
      const isAvailable = await merchantRepository.isSlugAvailable(
        input.slug,
        merchantId
      );
      if (!isAvailable) {
        throw new AppError(ErrorCodes.MERCHANT_SLUG_TAKEN, { slug: input.slug }, 409);
      }
    }

    // 构建更新数据
    const updateData: Prisma.MerchantUpdateInput = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.slug !== undefined) updateData.slug = input.slug;
    if (input.description !== undefined)
      updateData.description = input.description;
    if (input.address !== undefined) updateData.address = input.address;
    if (input.city !== undefined) updateData.city = input.city;
    if (input.state !== undefined) updateData.state = input.state;
    if (input.zipCode !== undefined) updateData.zipCode = input.zipCode;
    if (input.country !== undefined) updateData.country = input.country;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.logoUrl !== undefined) updateData.logoUrl = input.logoUrl;
    if (input.bannerUrl !== undefined) updateData.bannerUrl = input.bannerUrl;
    if (input.businessHours !== undefined)
      updateData.businessHours =
        input.businessHours as unknown as Prisma.InputJsonValue;
    if (input.timezone !== undefined) updateData.timezone = input.timezone;
    if (input.currency !== undefined) updateData.currency = input.currency;
    if (input.locale !== undefined) updateData.locale = input.locale;
    if (input.status !== undefined) updateData.status = input.status;

    // Settings 需要 merge
    if (input.settings !== undefined) {
      const currentSettings = existing.settings || {};
      updateData.settings = {
        ...currentSettings,
        ...input.settings,
      } as unknown as Prisma.InputJsonValue;
    }

    await merchantRepository.update(merchantId, updateData);

    const data = await merchantRepository.getByIdWithTenant(merchantId);
    return toMerchantWithTenant(data!);
  }

  /**
   * 更新 Merchant Settings
   * @param tenantId - 租户 ID
   * @param merchantId - 商户 ID
   * @param settings - 设置更新
   */
  async updateSettings(
    tenantId: string,
    merchantId: string,
    settings: UpdateMerchantSettingsInput
  ): Promise<MerchantWithTenant> {
    // 验证权限
    const existing = await this.getMerchant(tenantId, merchantId);
    if (!existing) {
      throw new AppError(ErrorCodes.MERCHANT_NOT_FOUND, undefined, 404);
    }

    const data = await merchantRepository.updateSettings(
      merchantId,
      settings as Record<string, unknown>
    );
    return toMerchantWithTenant(data!);
  }

  /**
   * 删除 Merchant
   * @param tenantId - 租户 ID
   * @param merchantId - 商户 ID
   */
  async deleteMerchant(tenantId: string, merchantId: string): Promise<void> {
    // 验证权限
    const existing = await this.getMerchant(tenantId, merchantId);
    if (!existing) {
      throw new AppError(ErrorCodes.MERCHANT_NOT_FOUND, undefined, 404);
    }

    await merchantRepository.delete(merchantId);
  }

  // ==================== 业务查询方法 ====================

  /**
   * 检查 Slug 是否可用
   */
  async isSlugAvailable(
    slug: string,
    excludeMerchantId?: string
  ): Promise<boolean> {
    return merchantRepository.isSlugAvailable(slug, excludeMerchantId);
  }

  /**
   * 检查 Merchant 是否营业中
   */
  async isOpen(merchantId: string): Promise<boolean> {
    return merchantRepository.isOpen(merchantId);
  }
}

export const merchantService = new MerchantService();
