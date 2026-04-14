// Website Template Types

import type { TipConfig, FeeConfig } from "./index";
import type { SocialLink } from "./tenant";
import type { BusinessHoursMap } from "./merchant";

// Re-export for convenience
export type { SocialLink, BusinessHoursMap };

/**
 * Website display info - combines data from Company and Merchant
 * This is a denormalized view for rendering website templates
 */
interface WebsiteMerchantInfo {
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
}

// Legacy alias - kept for backward compatibility
export type MerchantInfo = WebsiteMerchantInfo;

export interface FeaturedItem {
  id: string;
  menuItemId?: string; // For adding to cart
  name: string;
  description: string;
  price: number;
  image: string;
  category?: string;
  hasModifiers?: boolean; // Whether item has modifier options
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


export interface NavigationLink {
  label: string;
  href: string;
  isExternal?: boolean;
}
