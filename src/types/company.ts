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
  taxId: string | null;
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

// Featured item for homepage display (stored in settings until proper table is created)
export interface FeaturedItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category?: string;
  /** Links to actual menu item for add-to-cart functionality */
  menuItemId?: string;
  /** Whether the menu item has modifiers (requires modal) */
  hasModifiers?: boolean;
}

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
    featuredItems?: FeaturedItem[]; // Featured items for homepage
    reviews?: CustomerReview[]; // Customer reviews for homepage
  };
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
  taxId?: string;
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
  taxId?: string;
  settings?: CompanySettings;
  status?: CompanyStatus;
}
