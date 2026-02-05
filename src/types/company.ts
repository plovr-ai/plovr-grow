import type { ThemePresetName } from "./theme";

// ==================== Company Types ====================

import type { OnboardingStatus, OnboardingData } from './onboarding';

export type CompanyStatus = "active" | "inactive" | "suspended";

export interface CompanyInfo {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  legalName: string | null;
  description: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  currency: string;
  locale: string;
  timezone: string;
  status: CompanyStatus;

  // Onboarding fields
  onboardingStatus: OnboardingStatus;
  onboardingData: OnboardingData | null;
  onboardingCompletedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface SocialLink {
  platform: "facebook" | "instagram" | "twitter" | "yelp" | "google";
  url: string;
}

// Featured item reference - stored in Company settings
// Only stores menu item ID, actual data is fetched from menu database
export type FeaturedItemRef = string; // Menu item ID

// Customer review for homepage display (stored in settings until proper table is created)
export interface CustomerReview {
  id: string;
  customerName: string;
  rating: number; // 1-5
  content: string;
  date: string;
  source: "google" | "yelp" | "facebook" | "website";
  avatarUrl?: string;
}

export interface GiftcardConfig {
  enabled: boolean;
  denominations: number[]; // e.g., [30, 50, 100]
  imageUrl?: string;
  description?: string;
}

export interface CompanySettings {
  // Brand-level default settings (can be overridden by merchants)
  defaultCurrency?: string;
  defaultLocale?: string;
  defaultTimezone?: string;
  // Theme configuration
  themePreset?: ThemePresetName;

  // Website configuration (brand-level)
  website?: {
    tagline?: string; // Brand tagline, e.g., "Authentic New York Style Pizza Since 1985"
    heroImage?: string; // Default hero image for all merchants
    socialLinks?: SocialLink[]; // Brand social media links
    featuredItemIds?: FeaturedItemRef[]; // Menu item IDs for featured items
    reviews?: CustomerReview[]; // Customer reviews for homepage
  };

  // Giftcard configuration (Company-level)
  giftcard?: GiftcardConfig;
}

export interface MerchantSummary {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
  status: string;
}

export interface CompanyWithMerchants extends CompanyInfo {
  merchants: MerchantSummary[];
}

// ==================== Company Input Types ====================

export interface CreateCompanyInput {
  slug: string;
  name: string;
  legalName?: string;
  description?: string;
  logoUrl?: string;
  websiteUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
  currency?: string;
  locale?: string;
  timezone?: string;
  settings?: CompanySettings;
}

export interface UpdateCompanyInput {
  name?: string;
  legalName?: string;
  description?: string;
  logoUrl?: string;
  websiteUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
  currency?: string;
  locale?: string;
  timezone?: string;
  settings?: CompanySettings;
  status?: CompanyStatus;
}
