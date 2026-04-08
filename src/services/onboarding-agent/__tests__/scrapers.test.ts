import { describe, it, expect } from "vitest";
import { detectSourceType, getScraper } from "../scrapers";
import type { DataSourceType } from "../onboarding-agent.types";

describe("Scrapers", () => {
  describe("detectSourceType", () => {
    it("should detect DoorDash URLs", () => {
      expect(detectSourceType("https://www.doordash.com/store/test-restaurant-123")).toBe("doordash");
      expect(detectSourceType("https://doordash.com/store/test")).toBe("doordash");
    });

    it("should detect UberEats URLs", () => {
      expect(detectSourceType("https://www.ubereats.com/store/test-restaurant")).toBe("ubereats");
      expect(detectSourceType("https://ubereats.com/store/test")).toBe("ubereats");
    });

    it("should detect Google Business URLs", () => {
      expect(detectSourceType("https://www.google.com/maps/place/Test+Restaurant")).toBe("google_business");
      expect(detectSourceType("https://business.google.com/test")).toBe("google_business");
      expect(detectSourceType("https://maps.google.com/maps?q=test")).toBe("google_business");
    });

    it("should default to website for other URLs", () => {
      expect(detectSourceType("https://myrestaurant.com")).toBe("website");
      expect(detectSourceType("https://example.com/menu")).toBe("website");
    });
  });

  describe("getScraper", () => {
    it("should return correct scraper for each type", () => {
      expect(getScraper("website").getName()).toBe("website");
      expect(getScraper("doordash").getName()).toBe("doordash");
      expect(getScraper("ubereats").getName()).toBe("ubereats");
      expect(getScraper("google_business").getName()).toBe("google_business");
    });

    it("should throw for unknown type", () => {
      expect(() => getScraper("unknown" as unknown as DataSourceType)).toThrow("Unknown source type");
    });
  });

  describe("Scraper.canHandle", () => {
    it("WebsiteScraper should handle generic URLs", () => {
      const scraper = getScraper("website");
      expect(scraper.canHandle("https://myrestaurant.com")).toBe(true);
      expect(scraper.canHandle("https://example.com/menu")).toBe(true);
      // Should not handle platform URLs
      expect(scraper.canHandle("https://doordash.com/store/test")).toBe(false);
    });

    it("DoorDashScraper should only handle DoorDash URLs", () => {
      const scraper = getScraper("doordash");
      expect(scraper.canHandle("https://doordash.com/store/test")).toBe(true);
      expect(scraper.canHandle("https://www.doordash.com/store/test-123")).toBe(true);
      expect(scraper.canHandle("https://example.com")).toBe(false);
    });

    it("UberEatsScraper should only handle UberEats URLs", () => {
      const scraper = getScraper("ubereats");
      expect(scraper.canHandle("https://ubereats.com/store/test")).toBe(true);
      expect(scraper.canHandle("https://www.ubereats.com/store/test-123")).toBe(true);
      expect(scraper.canHandle("https://example.com")).toBe(false);
    });

    it("GoogleBusinessScraper should only handle Google URLs", () => {
      const scraper = getScraper("google_business");
      expect(scraper.canHandle("https://google.com/maps/place/Test")).toBe(true);
      expect(scraper.canHandle("https://business.google.com/test")).toBe(true);
      expect(scraper.canHandle("https://example.com")).toBe(false);
    });
  });
});
