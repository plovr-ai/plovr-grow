import type { ThemePresetName } from "./theme";
import type { OnboardingStatus, OnboardingData } from "./onboarding";

export type TenantStatus = "active" | "inactive" | "suspended";

export interface TenantInfo {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  currency: string;
  locale: string;
  timezone: string;
  status: TenantStatus;
  subscriptionPlan: string;
  subscriptionStatus: string;
  stripeConnectStatus: string | null;
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

export type FeaturedItemRef = string;

export interface CustomerReview {
  id: string;
  customerName: string;
  rating: number;
  content: string;
  date: string;
  source: "google" | "yelp" | "facebook" | "website";
  avatarUrl?: string;
}

export interface GiftcardConfig {
  enabled: boolean;
  denominations: number[];
  imageUrl?: string;
  description?: string;
}

export interface TenantSettings {
  defaultCurrency?: string;
  defaultLocale?: string;
  defaultTimezone?: string;
  themePreset?: ThemePresetName;
  website?: {
    tagline?: string;
    heroImage?: string;
    socialLinks?: SocialLink[];
    featuredItemIds?: FeaturedItemRef[];
    reviews?: CustomerReview[];
  };
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

export interface TenantWithMerchants extends TenantInfo {
  merchants: MerchantSummary[];
}

export interface CreateTenantInput {
  slug: string;
  name: string;
  description?: string;
  logoUrl?: string;
  websiteUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
  currency?: string;
  locale?: string;
  timezone?: string;
  settings?: TenantSettings;
}

export interface UpdateTenantInput {
  name?: string;
  description?: string;
  logoUrl?: string;
  websiteUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
  currency?: string;
  locale?: string;
  timezone?: string;
  settings?: TenantSettings;
  status?: TenantStatus;
}
