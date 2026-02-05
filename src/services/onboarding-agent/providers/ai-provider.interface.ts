/**
 * AI Provider Interface
 *
 * Defines the contract for AI providers (Claude, OpenAI, etc.)
 * that extract structured data from scraped content.
 */

import type {
  AIExtractionResult,
  ExtractionSchema,
  ExtractedRestaurantInfo,
  ExtractedMenuCategory,
} from "../onboarding-agent.types";

export interface AIProvider {
  /**
   * Extract structured data from raw content using AI
   *
   * @param content - The raw text/HTML content to process
   * @param schema - The expected output structure
   * @param instructions - Additional context-specific instructions
   * @returns Extraction result with typed data
   */
  extractStructuredData<T>(
    content: string,
    schema: ExtractionSchema,
    instructions: string
  ): Promise<AIExtractionResult<T>>;

  /**
   * Extract restaurant information from content
   */
  extractRestaurantInfo(
    content: string,
    sourceType: string
  ): Promise<AIExtractionResult<ExtractedRestaurantInfo>>;

  /**
   * Extract menu data from content
   */
  extractMenu(
    content: string,
    sourceType: string
  ): Promise<AIExtractionResult<{ categories: ExtractedMenuCategory[] }>>;

  /**
   * Get provider name (for logging/metrics)
   */
  getProviderName(): string;

  /**
   * Check if provider is configured properly
   */
  isConfigured(): boolean;
}

// ==================== Prompt Templates ====================

export const RESTAURANT_INFO_PROMPT = `You are an AI assistant that extracts structured restaurant information from web content.

Given the following content from a restaurant's web page, extract the restaurant information.

IMPORTANT GUIDELINES:
1. Only extract information that is explicitly present in the content
2. Do not make assumptions or fill in missing data
3. For image URLs, keep the original URLs as-is (do not modify)
4. Phone numbers should be in format: (XXX) XXX-XXXX or +1XXXXXXXXXX
5. State should be 2-letter abbreviation (e.g., CA, NY, TX)
6. Business hours should use 24-hour format (e.g., "09:00", "21:30")
7. Return null for any field where information is not clearly available

Return a JSON object with this exact structure:
{
  "name": string | null,
  "description": string | null,
  "tagline": string | null,
  "address": string | null,
  "city": string | null,
  "state": string | null,
  "zipCode": string | null,
  "phone": string | null,
  "email": string | null,
  "logoUrl": string | null,
  "heroImageUrl": string | null,
  "businessHours": {
    "monday": { "open": "HH:MM", "close": "HH:MM", "closed": boolean },
    "tuesday": { "open": "HH:MM", "close": "HH:MM", "closed": boolean },
    "wednesday": { "open": "HH:MM", "close": "HH:MM", "closed": boolean },
    "thursday": { "open": "HH:MM", "close": "HH:MM", "closed": boolean },
    "friday": { "open": "HH:MM", "close": "HH:MM", "closed": boolean },
    "saturday": { "open": "HH:MM", "close": "HH:MM", "closed": boolean },
    "sunday": { "open": "HH:MM", "close": "HH:MM", "closed": boolean }
  } | null,
  "socialLinks": [
    { "platform": "facebook|instagram|twitter|yelp|google", "url": string }
  ] | null
}

CONTENT:
---
{{CONTENT}}
---

Return ONLY the JSON object, no explanation or markdown.`;

export const MENU_EXTRACTION_PROMPT = `You are an AI assistant that extracts structured menu data from web content.

Given the following content from a restaurant's menu page, extract all menu categories and items.

IMPORTANT GUIDELINES:
1. Group items by their categories as shown in the content
2. Extract prices as decimal numbers (e.g., 12.99, not "$12.99")
3. If a price range is shown (e.g., "$10-15"), use the lower price
4. Keep image URLs as-is (original URLs)
5. Include descriptions if available
6. If an item appears in multiple categories, include it in each
7. Identify modifier groups if present (e.g., "Choose your size", "Add toppings")

Return a JSON object with this exact structure:
{
  "categories": [
    {
      "name": string,
      "description": string | null,
      "imageUrl": string | null,
      "items": [
        {
          "name": string,
          "description": string | null,
          "price": number,
          "imageUrl": string | null,
          "tags": string[] | null,
          "modifiers": [
            {
              "name": string,
              "type": "single" | "multiple",
              "required": boolean,
              "options": [
                { "name": string, "price": number }
              ]
            }
          ] | null
        }
      ]
    }
  ]
}

CONTENT:
---
{{CONTENT}}
---

Return ONLY the JSON object, no explanation or markdown.`;

export const DOORDASH_MENU_PROMPT = `You are extracting menu data from DoorDash restaurant page content.

ADDITIONAL GUIDELINES FOR DOORDASH:
1. DoorDash prices may be higher than restaurant prices (delivery markup)
2. Look for "Popular Items" or "Most Ordered" sections
3. Extract the original item names, not DoorDash-modified names
4. Note: DoorDash uses categories like "Popular Items", "Breakfast", etc.

${MENU_EXTRACTION_PROMPT}`;

export const UBEREATS_MENU_PROMPT = `You are extracting menu data from Uber Eats restaurant page content.

ADDITIONAL GUIDELINES FOR UBER EATS:
1. Uber Eats shows items with photos prominently - extract all image URLs
2. Look for "Picked for You" sections for popular items
3. Extract modifier/customization options (sizes, add-ons)
4. Note any "Limited time" or seasonal items

${MENU_EXTRACTION_PROMPT}`;

export const GOOGLE_BUSINESS_PROMPT = `You are extracting restaurant information from Google Business Profile content.

ADDITIONAL GUIDELINES FOR GOOGLE:
1. Google Business has reliable address and hours data
2. Extract the official business name
3. Look for "Popular times" data if available
4. Extract the Google rating and review count
5. Social links may be present in the "About" section

${RESTAURANT_INFO_PROMPT}`;
