/**
 * Scraper Interface
 *
 * Defines the contract for web scrapers that fetch content
 * from different sources (websites, DoorDash, UberEats, etc.)
 */

import type { ScrapeResult, DataSourceType } from "../onboarding-agent.types";

export interface Scraper {
  /**
   * Scrape content from the given URL
   *
   * @param url - The URL to scrape
   * @returns Scrape result with HTML, text, and metadata
   */
  scrape(url: string): Promise<ScrapeResult>;

  /**
   * Check if this scraper can handle the given URL
   *
   * @param url - The URL to check
   * @returns true if this scraper can handle the URL
   */
  canHandle(url: string): boolean;

  /**
   * Get the scraper name/type
   */
  getName(): DataSourceType;
}

/**
 * Base scraper with common functionality
 */
export abstract class BaseScraper implements Scraper {
  protected timeout: number;
  protected userAgent: string;

  constructor() {
    this.timeout = parseInt(process.env.SCRAPER_TIMEOUT_MS ?? "30000", 10);
    this.userAgent =
      process.env.SCRAPER_USER_AGENT ??
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  }

  abstract scrape(url: string): Promise<ScrapeResult>;
  abstract canHandle(url: string): boolean;
  abstract getName(): DataSourceType;

  /**
   * Extract clean text from HTML
   * Removes scripts, styles, and HTML tags
   */
  protected extractText(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Extract metadata from HTML
   */
  protected extractMetadata(html: string): {
    title?: string;
    description?: string;
    ogImage?: string;
  } {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch =
      html.match(
        /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
      ) ||
      html.match(
        /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i
      );
    const ogImageMatch =
      html.match(
        /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
      ) ||
      html.match(
        /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i
      );

    return {
      title: titleMatch?.[1]?.trim(),
      description: descMatch?.[1]?.trim(),
      ogImage: ogImageMatch?.[1]?.trim(),
    };
  }

  /**
   * Fetch URL with timeout and error handling
   */
  protected async fetchUrl(
    url: string,
    headers?: Record<string, string>
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": this.userAgent,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          ...headers,
        },
        signal: controller.signal,
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
