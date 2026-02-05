/**
 * Onboarding Agent Service
 *
 * AI-powered data import from external sources (website, DoorDash, UberEats, Google).
 */

export {
  OnboardingAgentService,
  onboardingAgentService,
} from "./onboarding-agent.service";

export type {
  DataSourceType,
  ImportSource,
  ImportOptions,
  ImportResult,
  PreviewResult,
  SourceResult,
  CreatedEntities,
  ExtractedData,
  ExtractedRestaurantInfo,
  ExtractedMenuCategory,
  ExtractedMenuItem,
  MergedData,
  MergedRestaurantInfo,
  MergedMenuCategory,
  MergedMenuItem,
  ScrapeResult,
  ScrapedContent,
  AIExtractionResult,
} from "./onboarding-agent.types";

// Re-export provider factory for testing
export { getAIProvider, resetAIProvider } from "./providers";

// Re-export scraper utilities
export { getScraper, detectSourceType } from "./scrapers";
