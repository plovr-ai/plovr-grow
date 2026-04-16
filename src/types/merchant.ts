// ==================== Merchant Types ====================

import type { TipConfig, FeeConfig } from "./index";

export type MerchantStatus = "active" | "inactive" | "temporarily_closed";

export interface PhoneAiSettings {
  greetings?: string;
  faq?: {
    savedFaqs?: Array<{ question: string; answer: string }>;
    customFaqs?: Array<{ question: string; answer: string }>;
  };
  agentWorkSwitch?: "0" | "1" | "2";
  forwardPhone?: string;
}

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
  phoneAiSettings: PhoneAiSettings | null;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Merchant Context ====================

export interface MerchantContext {
  merchantId: string;
  merchantSlug: string;
  tenantId: string;
}

// Note: Input types (CreateMerchantInput, UpdateMerchantInput) are defined in
// @/services/merchant/merchant.types.ts for better service encapsulation
