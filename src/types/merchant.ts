// ==================== Merchant Types ====================

import type { TipConfig, FeeConfig } from "./index";

export type MerchantStatus = "active" | "inactive" | "temporarily_closed";

export interface BusinessHoursMap {
  [key: string]: {
    open: string;
    close: string;
    closed?: boolean;
  };
}

export interface MerchantSettings {
  acceptsPickup: boolean;
  acceptsDelivery: boolean;
  deliveryRadius?: number;
  minimumOrderAmount?: number;
  estimatedPrepTime?: number; // minutes
  tipConfig?: TipConfig;
  feeConfig?: FeeConfig;
}

export interface MerchantInfo {
  id: string;
  companyId: string;
  slug: string;
  name: string;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  businessHours: BusinessHoursMap | null;
  timezone: string;
  currency: string;
  locale: string;
  taxRate: number;
  status: MerchantStatus;
  settings: MerchantSettings | null;
  createdAt: Date;
  updatedAt: Date;
}

// Public merchant info (for customer-facing pages, excludes sensitive data)
export interface PublicMerchantInfo {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  phone: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  businessHours: BusinessHoursMap | null;
  timezone: string;
  currency: string;
  locale: string;
  settings: Pick<
    MerchantSettings,
    "acceptsPickup" | "acceptsDelivery" | "tipConfig" | "feeConfig"
  > | null;
}

// ==================== Merchant Context ====================

export interface MerchantContext {
  merchantId: string;
  merchantSlug: string;
  companyId: string;
  tenantId: string;
}

// ==================== Merchant Input Types ====================

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
  taxRate?: number;
  settings?: MerchantSettings;
}

export interface UpdateMerchantInput {
  name?: string;
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
  taxRate?: number;
  settings?: MerchantSettings;
  status?: MerchantStatus;
}
