// ==================== Merchant Service Types ====================
// Service 接口类型定义，使用方从 @/services/merchant 导入

import type { CompanySettings } from "@/types/company";
import type {
  MerchantSettings,
  MerchantStatus,
  BusinessHoursMap,
} from "@/types/merchant";

// ==================== Response Types ====================

/**
 * Merchant with Company info - 用于需要 Company 上下文的场景
 */
export interface MerchantWithCompany {
  id: string;
  slug: string;
  name: string;
  companyId: string;
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
  company: {
    id: string;
    slug: string;
    tenantId: string;
    name: string;
    logoUrl?: string;
    settings?: CompanySettings;
    tenant: {
      id: string;
      name: string;
    };
  };
}

/**
 * Company with Merchants - 用于品牌页面展示门店列表
 */
export interface CompanyWithMerchants {
  id: string;
  slug: string;
  tenantId: string;
  name: string;
  description?: string;
  logoUrl?: string;
  settings?: CompanySettings;
  tenant: {
    id: string;
    name: string;
    subscriptionStatus: string;
  };
  merchants: MerchantWithCompany[];
}

/**
 * Merchant 基础信息 - 不含 Company 关联
 */
export interface MerchantBasic {
  id: string;
  slug: string;
  name: string;
  companyId: string;
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

import type { SocialLink, CustomerReview } from "@/types/company";
import type { FeaturedItem } from "@/types/website";
import type { TipConfig, FeeConfig } from "@/types/index";

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
  featuredItems?: FeaturedItem[];
  reviews?: CustomerReview[];
}
