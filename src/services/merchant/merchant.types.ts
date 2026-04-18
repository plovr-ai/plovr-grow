// ==================== Merchant Service Types ====================
// Service 接口类型定义，使用方从 @/services/merchant 导入

import type { TenantSettings } from "@/types/tenant";
import type {
  MerchantSettings,
  MerchantStatus,
  BusinessHoursMap,
  PhoneAiSettings,
} from "@/types/merchant";

// ==================== Response Types ====================

/**
 * Merchant with Tenant info - 用于需要 Tenant 上下文的场景
 */
export interface MerchantWithTenant {
  id: string;
  slug: string;
  name: string;
  tenantId: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  bannerUrl?: string;
  businessHours?: BusinessHoursMap;
  timezone: string;
  currency: string;
  locale: string;

  status: MerchantStatus;
  settings?: MerchantSettings;
  phoneAiSettings?: PhoneAiSettings;
  tenant: {
    id: string;
    slug: string | null;
    tenantId: string;
    name: string;
    logoUrl?: string;
    settings?: TenantSettings;
  };
}

/**
 * Tenant with Merchants - 用于品牌页面展示门店列表
 */
export interface TenantWithMerchants {
  id: string;
  slug: string | null;
  tenantId: string;
  name: string;
  description?: string;
  logoUrl?: string;
  settings?: TenantSettings;
  merchants: MerchantWithTenant[];
}

/**
 * Merchant 基础信息 - 不含 Tenant 关联
 */
export interface MerchantBasic {
  id: string;
  slug: string;
  name: string;
  tenantId: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  bannerUrl?: string;
  businessHours?: BusinessHoursMap;
  timezone: string;
  currency: string;
  locale: string;

  status: MerchantStatus;
  settings?: MerchantSettings;
  phoneAiSettings?: PhoneAiSettings;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Input Types ====================

/**
 * 创建 Merchant 输入
 */
export interface CreateMerchantInput {
  slug: string;
  name: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  bannerUrl?: string;
  businessHours?: BusinessHoursMap;
  timezone?: string;
  currency?: string;
  locale?: string;

  settings?: MerchantSettings;
}

/**
 * 更新 Merchant 输入
 */
export interface UpdateMerchantInput {
  name?: string;
  slug?: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  bannerUrl?: string;
  businessHours?: BusinessHoursMap;
  timezone?: string;
  currency?: string;
  locale?: string;

  settings?: Partial<MerchantSettings>;
  status?: MerchantStatus;
}

/**
 * 更新 Merchant Settings 输入
 */
export interface UpdateMerchantSettingsInput {
  acceptsPickup?: boolean;
  acceptsDelivery?: boolean;
  deliveryRadius?: number;
  minimumOrderAmount?: number;
  estimatedPrepTime?: number;
  tipConfig?: MerchantSettings["tipConfig"];
  feeConfig?: MerchantSettings["feeConfig"];
}

// ==================== Query Types ====================

/**
 * 获取 Merchants 列表的过滤条件
 */
export interface GetMerchantsFilter {
  status?: MerchantStatus;
  city?: string;
  state?: string;
}

// ==================== Website Data Types ====================

import type { SocialLink, CustomerReview } from "@/types/tenant";
import type { TipConfig, FeeConfig } from "@/types/index";
import type { WebsiteTemplateName } from "@/types/website-template";

/**
 * Website display data - 用于渲染网站模板
 * 合并 Company 和 Merchant 数据
 */
export interface WebsiteMerchantData {
  name: string;
  tagline: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  email: string;
  logo: string;
  heroImage: string;
  businessHours: BusinessHoursMap;
  socialLinks: SocialLink[];
  currency: string;
  locale: string;
  tipConfig?: TipConfig;
  feeConfig?: FeeConfig;
  reviews?: CustomerReview[];
  websiteTemplate: WebsiteTemplateName;
}
