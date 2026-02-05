/**
 * DoorDash Scraper
 *
 * Scrapes menu and restaurant info from DoorDash store pages.
 * DoorDash uses client-side rendering, so we look for embedded JSON data.
 */

import type { ScrapeResult, DataSourceType } from "../onboarding-agent.types";
import { BaseScraper } from "./scraper.interface";

export class DoorDashScraper extends BaseScraper {
  getName(): DataSourceType {
    return "doordash";
  }

  canHandle(url: string): boolean {
    return /doordash\.com\/store\//i.test(url);
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

      // Try to extract __NEXT_DATA__ JSON (Next.js SSR data)
      const nextData = this.extractNextData(html);

      // Try to extract JSON-LD structured data
      const jsonLd = this.extractJsonLd(html);

      // Combine extracted data into text for AI processing
      let text = this.extractText(html);

      if (nextData) {
        text += "\n\n[NEXT_DATA JSON]:\n" + JSON.stringify(nextData, null, 2);
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
   * Extract __NEXT_DATA__ JSON from Next.js pages
   */
  private extractNextData(html: string): Record<string, unknown> | null {
    const match = html.match(
      /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([^<]+)<\/script>/i
    );
    if (match) {
      try {
        const data = JSON.parse(match[1]);
        // Extract the relevant parts (pageProps usually contains the data)
        return data.props?.pageProps || data;
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Extract JSON-LD structured data (schema.org)
   */
  private extractJsonLd(html: string): Record<string, unknown>[] | null {
    const pattern =
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([^<]+)<\/script>/gi;
    const results: Record<string, unknown>[] = [];

    let match;
    while ((match = pattern.exec(html)) !== null) {
      try {
        const data = JSON.parse(match[1]);
        // Look for Restaurant or FoodEstablishment schema
        if (
          data["@type"] === "Restaurant" ||
          data["@type"] === "FoodEstablishment" ||
          data["@type"] === "LocalBusiness" ||
          data["@type"] === "Menu"
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
