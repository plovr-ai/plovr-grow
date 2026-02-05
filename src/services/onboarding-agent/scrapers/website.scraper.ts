/**
 * Generic Website Scraper
 *
 * Scrapes content from any restaurant website.
 */

import type { ScrapeResult, DataSourceType } from "../onboarding-agent.types";
import { BaseScraper } from "./scraper.interface";

export class WebsiteScraper extends BaseScraper {
  getName(): DataSourceType {
    return "website";
  }

  canHandle(url: string): boolean {
    // Can handle any HTTP/HTTPS URL that's not a known platform
    if (!/^https?:\/\//i.test(url)) {
      return false;
    }

    // Exclude known platforms (they have specialized scrapers)
    const platformPatterns = [
      /doordash\.com/i,
      /ubereats\.com/i,
      /google\.com\/maps/i,
      /business\.google\.com/i,
    ];

    return !platformPatterns.some((pattern) => pattern.test(url));
  }

  async scrape(url: string): Promise<ScrapeResult> {
    try {
      const response = await this.fetchUrl(url);

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const html = await response.text();
      const text = this.extractText(html);
      const metadata = this.extractMetadata(html);

      // Try to find menu page if not already on one
      const menuLinks = this.findMenuLinks(html, url);

      // If we found menu links, try to scrape the menu page too
      let menuHtml = "";
      let menuText = "";
      if (menuLinks.length > 0) {
        try {
          const menuResponse = await this.fetchUrl(menuLinks[0]);
          if (menuResponse.ok) {
            menuHtml = await menuResponse.text();
            menuText = this.extractText(menuHtml);
          }
        } catch {
          // Ignore menu scrape errors
        }
      }

      // Combine content
      const combinedHtml = menuHtml ? `${html}\n\n${menuHtml}` : html;
      const combinedText = menuText ? `${text}\n\n${menuText}` : text;

      return {
        success: true,
        content: {
          url,
          html: combinedHtml,
          text: combinedText,
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
   * Find links to menu pages
   */
  private findMenuLinks(html: string, baseUrl: string): string[] {
    const menuPatterns = [
      /href=["']([^"']*menu[^"']*)["']/gi,
      /href=["']([^"']*food[^"']*)["']/gi,
      /href=["']([^"']*order[^"']*)["']/gi,
    ];

    const links: string[] = [];
    const baseUrlObj = new URL(baseUrl);

    for (const pattern of menuPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        let link = match[1];

        // Convert relative URLs to absolute
        if (link.startsWith("/")) {
          link = `${baseUrlObj.origin}${link}`;
        } else if (!link.startsWith("http")) {
          link = `${baseUrlObj.origin}/${link}`;
        }

        // Only include links from the same domain
        try {
          const linkUrl = new URL(link);
          if (linkUrl.hostname === baseUrlObj.hostname) {
            links.push(link);
          }
        } catch {
          // Invalid URL, skip
        }
      }
    }

    // Remove duplicates
    return [...new Set(links)].slice(0, 3);
  }
}
