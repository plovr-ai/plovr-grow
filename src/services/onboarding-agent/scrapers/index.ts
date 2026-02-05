/**
 * Scraper Exports
 *
 * Factory and registry for web scrapers.
 */

import type { DataSourceType } from "../onboarding-agent.types";
import type { Scraper } from "./scraper.interface";
import { WebsiteScraper } from "./website.scraper";
import { DoorDashScraper } from "./doordash.scraper";
import { UberEatsScraper } from "./ubereats.scraper";
import { GoogleBusinessScraper } from "./google-business.scraper";

export type { Scraper } from "./scraper.interface";
export { BaseScraper } from "./scraper.interface";
export { WebsiteScraper } from "./website.scraper";
export { DoorDashScraper } from "./doordash.scraper";
export { UberEatsScraper } from "./ubereats.scraper";
export { GoogleBusinessScraper } from "./google-business.scraper";

/**
 * Scraper registry
 */
const scraperRegistry: Map<DataSourceType, Scraper> = new Map();

/**
 * Initialize scraper registry
 */
function initScrapers(): void {
  if (scraperRegistry.size > 0) return;

  scraperRegistry.set("website", new WebsiteScraper());
  scraperRegistry.set("doordash", new DoorDashScraper());
  scraperRegistry.set("ubereats", new UberEatsScraper());
  scraperRegistry.set("google_business", new GoogleBusinessScraper());
}

/**
 * Get scraper by source type
 */
export function getScraper(sourceType: DataSourceType): Scraper {
  initScrapers();
  const scraper = scraperRegistry.get(sourceType);
  if (!scraper) {
    throw new Error(`Unknown source type: ${sourceType}`);
  }
  return scraper;
}

/**
 * Get all registered scrapers
 */
export function getAllScrapers(): Map<DataSourceType, Scraper> {
  initScrapers();
  return scraperRegistry;
}

/**
 * Auto-detect source type from URL
 */
export function detectSourceType(url: string): DataSourceType {
  initScrapers();

  // Check specialized scrapers first (they have specific URL patterns)
  const specializedTypes: DataSourceType[] = [
    "doordash",
    "ubereats",
    "google_business",
  ];

  for (const type of specializedTypes) {
    const scraper = scraperRegistry.get(type);
    if (scraper?.canHandle(url)) {
      return type;
    }
  }

  // Default to generic website scraper
  return "website";
}
