/**
 * Data Merge Strategy
 *
 * Merges extracted data from multiple sources with conflict resolution.
 */

import type {
  DataSourceType,
  ExtractedData,
  ExtractedRestaurantInfo,
  ExtractedMenuCategory,
  ExtractedMenuItem,
  MergedData,
  MergedRestaurantInfo,
  MergedMenuCategory,
  MergedMenuItem,
} from "../onboarding-agent.types";

/**
 * Default priority for data sources
 * Higher number = higher priority
 */
const DEFAULT_PRIORITY: Record<DataSourceType, number> = {
  website: 10, // Restaurant's own website is most authoritative
  google_business: 8, // Google Business is usually accurate
  doordash: 5, // Delivery platforms may have outdated data
  ubereats: 5,
};

/**
 * Field-specific source preferences
 * First source in array is preferred
 */
const FIELD_PRIORITY: Record<string, DataSourceType[]> = {
  // Restaurant info - prefer official sources
  name: ["website", "google_business", "doordash", "ubereats"],
  description: ["website", "google_business", "doordash", "ubereats"],
  tagline: ["website", "google_business", "doordash", "ubereats"],

  // Address/contact - Google is most reliable
  address: ["google_business", "website", "doordash", "ubereats"],
  city: ["google_business", "website", "doordash", "ubereats"],
  state: ["google_business", "website", "doordash", "ubereats"],
  zipCode: ["google_business", "website", "doordash", "ubereats"],
  phone: ["google_business", "website", "doordash", "ubereats"],
  email: ["website", "google_business", "doordash", "ubereats"],
  businessHours: ["google_business", "website", "doordash", "ubereats"],

  // Images - delivery platforms often have better photos
  logoUrl: ["website", "google_business", "doordash", "ubereats"],
  heroImageUrl: ["website", "doordash", "ubereats", "google_business"],
  "menuItem.imageUrl": ["doordash", "ubereats", "website", "google_business"],

  // Menu prices - prefer website (no delivery markup)
  "menuItem.price": ["website", "google_business", "doordash", "ubereats"],

  // Social links
  socialLinks: ["website", "google_business", "doordash", "ubereats"],
};

export class MergeStrategy {
  private customPriorities: Record<string, number>;

  constructor(customPriorities?: Record<string, number>) {
    this.customPriorities = customPriorities ?? {};
  }

  /**
   * Merge extracted data from multiple sources
   */
  merge(extractedDataList: ExtractedData[]): MergedData {
    if (extractedDataList.length === 0) {
      throw new Error("No data to merge");
    }

    // Apply priorities and sort
    const priorities = { ...DEFAULT_PRIORITY, ...this.customPriorities };
    const sortedData = [...extractedDataList].sort(
      (a, b) => (priorities[b.source] || 0) - (priorities[a.source] || 0)
    );

    // Merge restaurant info
    const restaurant = this.mergeRestaurantInfo(sortedData);

    // Merge menu
    const categories = this.mergeMenu(sortedData);

    return {
      restaurant,
      menu: { name: "Imported Menu", categories },
      sources: extractedDataList.map((d) => d.source),
      mergedAt: new Date(),
    };
  }

  /**
   * Merge restaurant info from multiple sources
   */
  private mergeRestaurantInfo(
    sortedData: ExtractedData[]
  ): MergedRestaurantInfo {
    const result: MergedRestaurantInfo = {
      _sources: {},
    };

    const fields: (keyof ExtractedRestaurantInfo)[] = [
      "name",
      "description",
      "tagline",
      "address",
      "city",
      "state",
      "zipCode",
      "phone",
      "email",
      "logoUrl",
      "heroImageUrl",
      "businessHours",
      "socialLinks",
      "rating",
      "reviewCount",
    ];

    for (const field of fields) {
      const preferredSources =
        FIELD_PRIORITY[field] || sortedData.map((d) => d.source);

      for (const source of preferredSources) {
        const data = sortedData.find((d) => d.source === source);
        const value = data?.restaurant[field];

        if (value !== undefined && value !== null) {
          // Type assertion needed due to dynamic field access
          (result as unknown as Record<string, unknown>)[field] = value;
          result._sources[field] = source;
          break;
        }
      }
    }

    return result;
  }

  /**
   * Merge menu data from multiple sources
   */
  private mergeMenu(sortedData: ExtractedData[]): MergedMenuCategory[] {
    // Use a map to deduplicate categories by normalized name
    const categoryMap = new Map<string, MergedMenuCategory>();

    for (const data of sortedData) {
      for (const category of data.menu) {
        const normalizedName = this.normalizeString(category.name);

        if (!categoryMap.has(normalizedName)) {
          categoryMap.set(normalizedName, {
            name: category.name,
            description: category.description,
            imageUrl: category.imageUrl,
            items: [],
          });
        }

        // Merge items into existing category
        const existingCategory = categoryMap.get(normalizedName)!;
        this.mergeCategoryItems(existingCategory, category.items, data.source);

        // Update category description/image if missing
        if (!existingCategory.description && category.description) {
          existingCategory.description = category.description;
        }
        if (!existingCategory.imageUrl && category.imageUrl) {
          existingCategory.imageUrl = category.imageUrl;
        }
      }
    }

    return Array.from(categoryMap.values());
  }

  /**
   * Merge items into a category
   */
  private mergeCategoryItems(
    category: MergedMenuCategory,
    newItems: ExtractedMenuItem[],
    source: DataSourceType
  ): void {
    const itemMap = new Map<string, MergedMenuItem>();

    // Index existing items
    for (const item of category.items) {
      itemMap.set(this.normalizeString(item.name), item);
    }

    // Process new items
    for (const item of newItems) {
      const normalizedName = this.normalizeString(item.name);

      if (!itemMap.has(normalizedName)) {
        // New item - add it
        const mergedItem: MergedMenuItem = {
          ...item,
          _sources: { price: source, name: source },
        };
        itemMap.set(normalizedName, mergedItem);
      } else {
        // Existing item - merge fields
        const existing = itemMap.get(normalizedName)!;

        // Track price variants for warnings
        if (existing.price !== item.price) {
          if (!existing._priceVariants) {
            existing._priceVariants = [
              { source: existing._sources.price, price: existing.price },
            ];
          }
          existing._priceVariants.push({ source, price: item.price });
        }

        // Fill in missing fields
        if (!existing.description && item.description) {
          existing.description = item.description;
        }
        if (!existing.imageUrl && item.imageUrl) {
          // Use field priority for images
          const imagePreferred =
            FIELD_PRIORITY["menuItem.imageUrl"] || [source];
          if (imagePreferred.indexOf(source) !== -1) {
            existing.imageUrl = item.imageUrl;
          }
        }
        if (!existing.tags && item.tags) {
          existing.tags = item.tags;
        }
        if (!existing.modifiers && item.modifiers) {
          existing.modifiers = item.modifiers;
        }
      }
    }

    category.items = Array.from(itemMap.values());
  }

  /**
   * Normalize string for comparison
   * Lowercases and removes non-alphanumeric characters
   */
  private normalizeString(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  /**
   * Generate warnings for merged data
   */
  generateWarnings(mergedData: MergedData): string[] {
    const warnings: string[] = [];

    // Check for price discrepancies
    for (const category of mergedData.menu.categories) {
      for (const item of category.items) {
        if (item._priceVariants && item._priceVariants.length > 1) {
          const priceList = item._priceVariants
            .map((v) => `$${v.price.toFixed(2)} (${v.source})`)
            .join(", ");
          warnings.push(
            `Price difference for "${item.name}": ${priceList}. Using ${item._sources.price} price.`
          );
        }
      }
    }

    return warnings;
  }
}
