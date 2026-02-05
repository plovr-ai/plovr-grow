/**
 * Onboarding Agent Types
 *
 * Types for the AI-powered onboarding agent that scrapes external sources
 * (website, DoorDash, UberEats, Google) and imports restaurant/menu data.
 */

// ==================== Data Source Types ====================

export type DataSourceType =
  | "website"
  | "doordash"
  | "ubereats"
  | "google_business";

export interface ImportSource {
  type: DataSourceType;
  url: string;
  /** Higher priority sources win in conflicts (default: based on type) */
  priority?: number;
}

// ==================== Scraped Content ====================

export interface ScrapedContent {
  url: string;
  html: string;
  /** Cleaned text content (scripts/styles removed) */
  text: string;
  metadata: {
    title?: string;
    description?: string;
    ogImage?: string;
  };
  scrapedAt: Date;
}

export interface ScrapeResult {
  success: boolean;
  content?: ScrapedContent;
  error?: string;
}

// ==================== Extracted Data Types ====================

export interface ExtractedBusinessHours {
  [day: string]: {
    open: string; // "09:00" (24-hour format)
    close: string; // "21:00"
    closed?: boolean;
  };
}

export interface ExtractedSocialLink {
  platform: "facebook" | "instagram" | "twitter" | "yelp" | "google";
  url: string;
}

export interface ExtractedRestaurantInfo {
  name?: string;
  description?: string;
  tagline?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  heroImageUrl?: string;
  businessHours?: ExtractedBusinessHours;
  socialLinks?: ExtractedSocialLink[];
  rating?: number;
  reviewCount?: number;
}

export interface ExtractedModifierOption {
  name: string;
  price: number;
}

export interface ExtractedModifier {
  name: string;
  type: "single" | "multiple";
  required: boolean;
  options: ExtractedModifierOption[];
}

export interface ExtractedMenuItem {
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  tags?: string[];
  modifiers?: ExtractedModifier[];
}

export interface ExtractedMenuCategory {
  name: string;
  description?: string;
  imageUrl?: string;
  items: ExtractedMenuItem[];
}

export interface ExtractedData {
  source: DataSourceType;
  sourceUrl: string;
  scrapedAt: Date;
  restaurant: ExtractedRestaurantInfo;
  menu: ExtractedMenuCategory[];
  /** AI confidence score 0-1 */
  confidence: number;
}

// ==================== Merged Data Types ====================

export interface MergedRestaurantInfo extends ExtractedRestaurantInfo {
  /** Tracks which source each field came from */
  _sources: Partial<Record<keyof ExtractedRestaurantInfo, DataSourceType>>;
}

export interface MergedMenuItem extends ExtractedMenuItem {
  _sources: {
    price: DataSourceType;
    name: DataSourceType;
  };
  /** Price variants from different sources (for warnings) */
  _priceVariants?: { source: DataSourceType; price: number }[];
}

export interface MergedMenuCategory {
  name: string;
  description?: string;
  imageUrl?: string;
  items: MergedMenuItem[];
}

export interface MergedData {
  restaurant: MergedRestaurantInfo;
  menu: {
    name: string;
    categories: MergedMenuCategory[];
  };
  sources: DataSourceType[];
  mergedAt: Date;
}

// ==================== Import Options & Results ====================

export interface ImportOptions {
  /** Create menu and items (default: true) */
  createMenu?: boolean;
  /** Update merchant info (default: true) */
  updateMerchant?: boolean;
  /** Update company info (default: false) */
  updateCompany?: boolean;
  /** Custom menu name (default: "Imported Menu") */
  menuName?: string;
}

export interface SourceResult {
  type: DataSourceType;
  url: string;
  status: "success" | "failed" | "partial";
  error?: string;
  extractedCategories?: number;
  extractedItems?: number;
}

export interface CreatedEntities {
  menuId?: string;
  categories: { id: string; name: string }[];
  items: { id: string; name: string; categoryId: string }[];
  merchantUpdated: boolean;
  companyUpdated: boolean;
}

export interface ImportResult {
  success: boolean;
  sources: SourceResult[];
  created: CreatedEntities;
  warnings: string[];
  /** Duration in milliseconds */
  duration: number;
}

export interface PreviewResult {
  success: boolean;
  sources: SourceResult[];
  preview: {
    restaurant: MergedRestaurantInfo;
    menu: MergedMenuCategory[];
  };
  warnings: string[];
}

// ==================== AI Extraction Types ====================

export interface AIExtractionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  tokensUsed?: number;
  model?: string;
}

export type ExtractionType = "restaurant_info" | "menu";

export interface ExtractionSchema {
  type: ExtractionType;
  fields: SchemaField[];
}

export interface SchemaField {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  required: boolean;
  description: string;
  nested?: SchemaField[];
}

// ==================== Pre-defined Schemas ====================

export const RESTAURANT_INFO_SCHEMA: ExtractionSchema = {
  type: "restaurant_info",
  fields: [
    {
      name: "name",
      type: "string",
      required: true,
      description: "Restaurant name",
    },
    {
      name: "description",
      type: "string",
      required: false,
      description: "Restaurant description or about text",
    },
    {
      name: "tagline",
      type: "string",
      required: false,
      description: "Short tagline or slogan",
    },
    {
      name: "address",
      type: "string",
      required: false,
      description: "Street address",
    },
    {
      name: "city",
      type: "string",
      required: false,
      description: "City name",
    },
    {
      name: "state",
      type: "string",
      required: false,
      description: "State abbreviation (e.g., CA, NY)",
    },
    {
      name: "zipCode",
      type: "string",
      required: false,
      description: "5-digit ZIP code",
    },
    {
      name: "phone",
      type: "string",
      required: false,
      description: "Phone number",
    },
    {
      name: "email",
      type: "string",
      required: false,
      description: "Contact email",
    },
    {
      name: "logoUrl",
      type: "string",
      required: false,
      description: "URL to logo image",
    },
    {
      name: "heroImageUrl",
      type: "string",
      required: false,
      description: "URL to main hero/banner image",
    },
    {
      name: "businessHours",
      type: "object",
      required: false,
      description: "Business hours by day",
    },
    {
      name: "socialLinks",
      type: "array",
      required: false,
      description: "Social media links",
    },
  ],
};

export const MENU_SCHEMA: ExtractionSchema = {
  type: "menu",
  fields: [
    {
      name: "categories",
      type: "array",
      required: true,
      description: "Menu categories",
      nested: [
        {
          name: "name",
          type: "string",
          required: true,
          description: "Category name",
        },
        {
          name: "description",
          type: "string",
          required: false,
          description: "Category description",
        },
        {
          name: "items",
          type: "array",
          required: true,
          description: "Menu items in this category",
          nested: [
            {
              name: "name",
              type: "string",
              required: true,
              description: "Item name",
            },
            {
              name: "description",
              type: "string",
              required: false,
              description: "Item description",
            },
            {
              name: "price",
              type: "number",
              required: true,
              description: "Price in dollars (e.g., 12.99)",
            },
            {
              name: "imageUrl",
              type: "string",
              required: false,
              description: "URL to item image",
            },
          ],
        },
      ],
    },
  ],
};
