// Website Template Types

import type { TipConfig } from "./index";
import type { ThemePresetName } from "./theme";

export interface MerchantInfo {
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
  /** Theme preset name for merchant branding */
  themePreset?: ThemePresetName;
}

export interface BusinessHoursMap {
  [key: string]: {
    open: string;
    close: string;
    closed?: boolean;
  };
}

export interface SocialLink {
  platform: "facebook" | "instagram" | "twitter" | "yelp" | "google";
  url: string;
}

export interface FeaturedItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category?: string;
}

export interface CustomerReview {
  id: string;
  customerName: string;
  rating: number; // 1-5
  content: string;
  date: string;
  source: "google" | "yelp" | "facebook" | "website";
  avatarUrl?: string;
}

export interface WebsiteData {
  merchant: MerchantInfo;
  featuredItems: FeaturedItem[];
  reviews: CustomerReview[];
}

export interface NavigationLink {
  label: string;
  href: string;
  isExternal?: boolean;
}
