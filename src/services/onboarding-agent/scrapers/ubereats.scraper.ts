/**
 * UberEats Scraper
 *
 * Scrapes menu and restaurant info from UberEats store pages.
 * Similar to DoorDash, UberEats uses client-side rendering.
 */

import type { ScrapeResult, DataSourceType } from "../onboarding-agent.types";
import { BaseScraper } from "./scraper.interface";

export class UberEatsScraper extends BaseScraper {
  getName(): DataSourceType {
    return "ubereats";
  }

  canHandle(url: string): boolean {
    return /ubereats\.com\/store\//i.test(url);
  }

  async scrape(url: string): Promise<ScrapeResult> {
    try {
      const response = await this.fetchUrl(url, {
        Accept: "text/html,application/xhtml+xml",
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const html = await response.text();
      const metadata = this.extractMetadata(html);

      // Extract embedded state/data
      const stateData = this.extractStateData(html);

      // Extract JSON-LD
      const jsonLd = this.extractJsonLd(html);

      // Combine into text
      let text = this.extractText(html);

      if (stateData) {
        text += "\n\n[EMBEDDED STATE]:\n" + JSON.stringify(stateData, null, 2);
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
   * Extract embedded state data from UberEats pages
   */
  private extractStateData(html: string): Record<string, unknown> | null {
    // UberEats may embed data in various ways
    const patterns = [
      /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([^<]+)<\/script>/i,
      /window\.__PRELOADED_STATE__\s*=\s*({[^;]+});/,
      /window\.__INITIAL_STATE__\s*=\s*({[^;]+});/,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        try {
          const data = JSON.parse(match[1]);
          return data.props?.pageProps || data;
        } catch {
          continue;
        }
      }
    }

    return null;
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
        if (
          data["@type"] === "Restaurant" ||
          data["@type"] === "FoodEstablishment" ||
          data["@type"] === "LocalBusiness" ||
          data["@type"] === "Menu" ||
          (Array.isArray(data) &&
            data.some(
              (d: Record<string, unknown>) =>
                d["@type"] === "Restaurant" || d["@type"] === "Menu"
            ))
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
