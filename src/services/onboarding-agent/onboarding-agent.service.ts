/**
 * Onboarding Agent Service
 *
 * Main orchestration service for AI-powered data import from external sources.
 */

import type {
  ImportSource,
  ImportResult,
  ImportOptions,
  SourceResult,
  ExtractedData,
  MergedData,
  DataSourceType,
  CreatedEntities,
  MergedMenuCategory,
  MergedMenuItem,
} from "./onboarding-agent.types";
import { getAIProvider } from "./providers";
import { getScraper, detectSourceType } from "./scrapers";
import {
  MergeStrategy,
  normalizeRestaurantInfo,
  normalizeMenuCategories,
} from "./normalizers";
import type { AIProvider } from "./providers";

// Lazy-load repositories and services to avoid initialization issues
async function getServices() {
  const [{ menuService }, { merchantService }] = await Promise.all([
    import("@/services/menu"),
    import("@/services/merchant"),
  ]);
  return { menuService, merchantService };
}

export class OnboardingAgentService {
  private aiProvider: AIProvider;
  private mergeStrategy: MergeStrategy;

  constructor() {
    this.aiProvider = getAIProvider();
    this.mergeStrategy = new MergeStrategy();
  }

  /**
   * Import data from multiple sources
   *
   * This is a one-step process:
   * 1. Scrape all sources in parallel
   * 2. Extract structured data using AI
   * 3. Merge data from multiple sources
   * 4. Create/update database records
   */
  async importFromSources(
    tenantId: string,
    companyId: string,
    merchantId: string,
    sources: ImportSource[],
    options?: ImportOptions
  ): Promise<ImportResult> {
    const startTime = Date.now();
    const sourceResults: SourceResult[] = [];
    const warnings: string[] = [];

    const opts: Required<ImportOptions> = {
      createMenu: options?.createMenu ?? true,
      updateMerchant: options?.updateMerchant ?? true,
      updateCompany: options?.updateCompany ?? false,
      menuName: options?.menuName ?? "Imported Menu",
    };

    try {
      // Step 1: Scrape all sources in parallel
      console.log(
        `[OnboardingAgent] Scraping ${sources.length} source(s)...`
      );
      const scrapedResults = await this.scrapeAllSources(sources);

      // Step 2: Extract data using AI
      console.log("[OnboardingAgent] Extracting data with AI...");
      const extractedDataList: ExtractedData[] = [];

      for (const { source, scrapeResult } of scrapedResults) {
        if (!scrapeResult.success || !scrapeResult.content) {
          sourceResults.push({
            type: source.type,
            url: source.url,
            status: "failed",
            error: scrapeResult.error || "Failed to scrape",
          });
          continue;
        }

        const extracted = await this.extractData(
          scrapeResult.content.text,
          source.type
        );

        if (extracted) {
          extractedDataList.push({
            source: source.type,
            sourceUrl: source.url,
            scrapedAt: scrapeResult.content.scrapedAt,
            restaurant: normalizeRestaurantInfo(extracted.restaurant),
            menu: normalizeMenuCategories(extracted.menu),
            confidence: 0.8, // Default confidence
          });

          sourceResults.push({
            type: source.type,
            url: source.url,
            status: "success",
            extractedCategories: extracted.menu.length,
            extractedItems: extracted.menu.reduce(
              (sum, cat) => sum + cat.items.length,
              0
            ),
          });
        } else {
          sourceResults.push({
            type: source.type,
            url: source.url,
            status: "failed",
            error: "Failed to extract data",
          });
        }
      }

      // Check if we have any successful extractions
      if (extractedDataList.length === 0) {
        return {
          success: false,
          sources: sourceResults,
          created: {
            categories: [],
            items: [],
            merchantUpdated: false,
            companyUpdated: false,
          },
          warnings: ["No data could be extracted from any source"],
          duration: Date.now() - startTime,
        };
      }

      // Step 3: Merge data from multiple sources
      console.log("[OnboardingAgent] Merging data...");
      const mergedData = this.mergeStrategy.merge(extractedDataList);
      warnings.push(...this.mergeStrategy.generateWarnings(mergedData));

      // Step 4: Persist to database
      console.log("[OnboardingAgent] Persisting data...");
      const created = await this.persistData(
        tenantId,
        companyId,
        merchantId,
        mergedData,
        opts
      );

      console.log(
        `[OnboardingAgent] Import complete: ${created.categories.length} categories, ${created.items.length} items`
      );

      return {
        success: true,
        sources: sourceResults,
        created,
        warnings,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error("[OnboardingAgent] Import failed:", error);
      return {
        success: false,
        sources: sourceResults,
        created: {
          categories: [],
          items: [],
          merchantUpdated: false,
          companyUpdated: false,
        },
        warnings: [
          error instanceof Error ? error.message : "Unknown error occurred",
        ],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Scrape all sources in parallel
   */
  private async scrapeAllSources(sources: ImportSource[]) {
    const scrapePromises = sources.map(async (source) => {
      const sourceType = source.type || detectSourceType(source.url);
      const scraper = getScraper(sourceType);

      console.log(`[OnboardingAgent] Scraping ${sourceType}: ${source.url}`);
      const result = await scraper.scrape(source.url);

      return {
        source: { ...source, type: sourceType },
        scrapeResult: result,
      };
    });

    return Promise.all(scrapePromises);
  }

  /**
   * Extract structured data using AI
   */
  private async extractData(
    content: string,
    sourceType: DataSourceType
  ): Promise<{
    restaurant: ReturnType<typeof normalizeRestaurantInfo> extends infer T
      ? T
      : never;
    menu: ReturnType<typeof normalizeMenuCategories>;
  } | null> {
    // Extract restaurant info
    const restaurantResult = await this.aiProvider.extractRestaurantInfo(
      content,
      sourceType
    );

    // Extract menu
    const menuResult = await this.aiProvider.extractMenu(content, sourceType);

    if (!restaurantResult.success && !menuResult.success) {
      console.error(
        `[OnboardingAgent] AI extraction failed for ${sourceType}`
      );
      return null;
    }

    return {
      restaurant: restaurantResult.data || {},
      menu: menuResult.data?.categories || [],
    };
  }

  /**
   * Persist merged data to database
   */
  private async persistData(
    tenantId: string,
    companyId: string,
    merchantId: string,
    mergedData: MergedData,
    options: Required<ImportOptions>
  ): Promise<CreatedEntities> {
    const { menuService, merchantService } = await getServices();

    const created: CreatedEntities = {
      categories: [],
      items: [],
      merchantUpdated: false,
      companyUpdated: false,
    };

    // Update merchant info if requested
    if (options.updateMerchant) {
      const merchantUpdated = await this.updateMerchantData(
        tenantId,
        merchantId,
        merchantService,
        mergedData
      );
      created.merchantUpdated = merchantUpdated;
    }

    // Create menu if requested
    if (options.createMenu && mergedData.menu.categories.length > 0) {
      const menuResult = await this.createMenuData(
        tenantId,
        companyId,
        menuService,
        mergedData,
        options.menuName
      );

      created.menuId = menuResult.menuId;
      created.categories = menuResult.categories;
      created.items = menuResult.items;
    }

    return created;
  }

  /**
   * Update merchant with extracted data
   */
  private async updateMerchantData(
    tenantId: string,
    merchantId: string,
    merchantService: Awaited<ReturnType<typeof getServices>>["merchantService"],
    mergedData: MergedData
  ): Promise<boolean> {
    const { restaurant } = mergedData;

    const updateData: Record<string, unknown> = {};

    if (restaurant.address) updateData.address = restaurant.address;
    if (restaurant.city) updateData.city = restaurant.city;
    if (restaurant.state) updateData.state = restaurant.state;
    if (restaurant.zipCode) updateData.zipCode = restaurant.zipCode;
    if (restaurant.phone) updateData.phone = restaurant.phone;
    if (restaurant.email) updateData.email = restaurant.email;
    if (restaurant.logoUrl) updateData.logoUrl = restaurant.logoUrl;
    if (restaurant.heroImageUrl) updateData.bannerUrl = restaurant.heroImageUrl;
    if (restaurant.businessHours) {
      updateData.businessHours = restaurant.businessHours;
    }

    if (Object.keys(updateData).length === 0) {
      return false;
    }

    try {
      await merchantService.updateMerchant(tenantId, merchantId, updateData);
      return true;
    } catch (error) {
      console.error("[OnboardingAgent] Failed to update merchant:", error);
      return false;
    }
  }

  /**
   * Create menu, categories, and items
   */
  private async createMenuData(
    tenantId: string,
    companyId: string,
    menuService: Awaited<ReturnType<typeof getServices>>["menuService"],
    mergedData: MergedData,
    menuName: string
  ): Promise<{
    menuId: string;
    categories: { id: string; name: string }[];
    items: { id: string; name: string; categoryId: string }[];
  }> {
    const result = {
      menuId: "",
      categories: [] as { id: string; name: string }[],
      items: [] as { id: string; name: string; categoryId: string }[],
    };

    // Get or create menu
    const menus = await menuService.getMenus(tenantId, companyId);
    let menuId: string;

    if (menus.length === 0) {
      const menu = await menuService.createMenu(tenantId, companyId, {
        name: menuName,
        sortOrder: 0,
      });
      menuId = menu.id;
    } else {
      menuId = menus[0].id;
    }

    result.menuId = menuId;

    // Create categories and items
    for (let catIndex = 0; catIndex < mergedData.menu.categories.length; catIndex++) {
      const category = mergedData.menu.categories[catIndex];

      // Create category
      const createdCategory = await menuService.createCategory(
        tenantId,
        companyId,
        {
          menuId,
          name: category.name,
          description: category.description ?? undefined,
          imageUrl: category.imageUrl ?? undefined,
          sortOrder: catIndex,
        }
      );

      result.categories.push({
        id: createdCategory.id,
        name: createdCategory.name,
      });

      // Create items in this category
      for (const item of category.items) {
        const createdItem = await menuService.createMenuItem(
          tenantId,
          companyId,
          {
            categoryIds: [createdCategory.id],
            name: item.name,
            description: item.description ?? undefined,
            price: item.price,
            imageUrl: item.imageUrl ?? undefined,
            modifierGroups: this.convertModifiers(item),
            tags: item.tags ?? undefined,
          }
        );

        result.items.push({
          id: createdItem.id,
          name: createdItem.name,
          categoryId: createdCategory.id,
        });
      }
    }

    return result;
  }

  /**
   * Convert extracted modifiers to MenuService format
   */
  private convertModifiers(item: MergedMenuItem) {
    if (!item.modifiers || item.modifiers.length === 0) {
      return undefined;
    }

    return item.modifiers.map((mod, index) => ({
      id: `mod_${index}_${Date.now()}`,
      name: mod.name,
      type: mod.type,
      required: mod.required,
      modifiers: mod.options.map((opt, optIndex) => ({
        id: `opt_${index}_${optIndex}_${Date.now()}`,
        name: opt.name,
        price: opt.price,
      })),
    }));
  }
}

// Export singleton instance
export const onboardingAgentService = new OnboardingAgentService();
