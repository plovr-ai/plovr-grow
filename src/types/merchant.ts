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

  // Website configuration (merchant-level, can override company defaults)
  website?: {
    tagline?: string; // Override company tagline for this location
    heroImage?: string; // Override company hero image for this location
  };
}

export interface MerchantInfo {
  id: string;
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
  tenantId: string;
}

// Note: Input types (CreateMerchantInput, UpdateMerchantInput) are defined in
// @/services/merchant/merchant.types.ts for better service encapsulation
