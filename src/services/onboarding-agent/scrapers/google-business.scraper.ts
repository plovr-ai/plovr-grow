/**
 * Google Business Profile Scraper
 *
 * Scrapes restaurant info from Google Business Profile / Google Maps pages.
 * Google has reliable address, hours, and review data.
 */

import type { ScrapeResult, DataSourceType } from "../onboarding-agent.types";
import { BaseScraper } from "./scraper.interface";

export class GoogleBusinessScraper extends BaseScraper {
  getName(): DataSourceType {
    return "google_business";
  }

  canHandle(url: string): boolean {
    return (
      /google\.com\/maps\/place\//i.test(url) ||
      /business\.google\.com/i.test(url) ||
      /maps\.google\.com/i.test(url) ||
      /g\.co\/kgs\//i.test(url)
    );
  }

  async scrape(url: string): Promise<ScrapeResult> {
    try {
      // Google Maps uses heavily client-side rendering
      // We'll try to get what we can from the initial HTML
      const response = await this.fetchUrl(url, {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      });

      if (!response.ok) {
        // Handle redirects
        if (response.status >= 300 && response.status < 400) {
          const redirectUrl = response.headers.get("location");
          if (redirectUrl) {
            return this.scrape(redirectUrl);
          }
        }
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const html = await response.text();
      const metadata = this.extractMetadata(html);

      // Try to extract embedded data
      const embeddedData = this.extractEmbeddedData(html);

      // Extract JSON-LD
      const jsonLd = this.extractJsonLd(html);

      // Get clean text
      let text = this.extractText(html);

      if (embeddedData) {
        text +=
          "\n\n[EMBEDDED DATA]:\n" + JSON.stringify(embeddedData, null, 2);
      }

      if (jsonLd) {
        text += "\n\n[JSON-LD DATA]:\n" + JSON.stringify(jsonLd, null, 2);
      }

      return {
        success: true,
        content: {
          url,
          html,
          text,
          metadata,
          scrapedAt: new Date(),
        },
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return {
          success: false,
          error: "Request timeout",
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Extract embedded data from Google Maps pages
   */
  private extractEmbeddedData(html: string): Record<string, unknown> | null {
    // Google Maps embeds data in various formats
    // Try to find the APP_INITIALIZATION_STATE or similar
    const patterns = [
      /window\.APP_INITIALIZATION_STATE\s*=\s*(\[[^\]]+\])/,
      /window\.WIZ_global_data\s*=\s*({[^;]+});/,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        try {
          return JSON.parse(match[1]);
        } catch {
          continue;
        }
      }
    }

    // Try to extract business info from meta tags
    const businessInfo: Record<string, string> = {};

    const ogTitle = html.match(
      /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i
    );
    if (ogTitle) businessInfo.name = ogTitle[1];

    const ogDescription = html.match(
      /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i
    );
    if (ogDescription) businessInfo.description = ogDescription[1];

    return Object.keys(businessInfo).length > 0 ? businessInfo : null;
  }

  /**
   * Extract JSON-LD structured data
   */
  private extractJsonLd(html: string): Record<string, unknown>[] | null {
    const pattern =
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([^<]+)<\/script>/gi;
    const results: Record<string, unknown>[] = [];

    let match;
    while ((match = pattern.exec(html)) !== null) {
      try {
        const data = JSON.parse(match[1]);
        // Accept any LocalBusiness type or Restaurant
        if (
          data["@type"] === "Restaurant" ||
          data["@type"] === "FoodEstablishment" ||
          data["@type"] === "LocalBusiness" ||
          (typeof data["@type"] === "string" &&
            data["@type"].includes("Restaurant"))
        ) {
          results.push(data);
        }
      } catch {
        // Invalid JSON, skip
      }
    }

    return results.length > 0 ? results : null;
  }
}
