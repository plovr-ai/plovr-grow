import { describe, it, expect } from "vitest";
import { MergeStrategy } from "../normalizers/merge-strategy";
import type { ExtractedData } from "../onboarding-agent.types";

describe("MergeStrategy", () => {
  const mergeStrategy = new MergeStrategy();

  describe("merge", () => {
    it("should merge data from single source", () => {
      const extractedData: ExtractedData[] = [
        {
          source: "website",
          sourceUrl: "https://example.com",
          scrapedAt: new Date(),
          restaurant: {
            name: "Test Restaurant",
            address: "123 Main St",
            city: "San Francisco",
            state: "CA",
            phone: "(415) 555-1234",
          },
          menu: [
            {
              name: "Appetizers",
              items: [
                { name: "Spring Rolls", price: 8.99 },
                { name: "Edamame", price: 5.99 },
              ],
            },
          ],
          confidence: 0.9,
        },
      ];

      const result = mergeStrategy.merge(extractedData);

      expect(result.restaurant.name).toBe("Test Restaurant");
      expect(result.restaurant.address).toBe("123 Main St");
      expect(result.restaurant._sources.name).toBe("website");
      expect(result.menu.categories).toHaveLength(1);
      expect(result.menu.categories[0].items).toHaveLength(2);
    });

    it("should prefer website data over delivery platforms", () => {
      const extractedData: ExtractedData[] = [
        {
          source: "doordash",
          sourceUrl: "https://doordash.com/store/test",
          scrapedAt: new Date(),
          restaurant: {
            name: "DoorDash Name",
            phone: "(555) 111-2222",
          },
          menu: [
            {
              name: "Main",
              items: [{ name: "Burger", price: 15.99 }],
            },
          ],
          confidence: 0.8,
        },
        {
          source: "website",
          sourceUrl: "https://example.com",
          scrapedAt: new Date(),
          restaurant: {
            name: "Website Name",
            phone: "(415) 555-1234",
          },
          menu: [
            {
              name: "Main",
              items: [{ name: "Burger", price: 12.99 }],
            },
          ],
          confidence: 0.9,
        },
      ];

      const result = mergeStrategy.merge(extractedData);

      // Website should be preferred for name
      expect(result.restaurant.name).toBe("Website Name");
      expect(result.restaurant._sources.name).toBe("website");

      // Website price should be used (no delivery markup)
      expect(result.menu.categories[0].items[0].price).toBe(12.99);
    });

    it("should prefer Google for address data", () => {
      const extractedData: ExtractedData[] = [
        {
          source: "website",
          sourceUrl: "https://example.com",
          scrapedAt: new Date(),
          restaurant: {
            name: "Test Restaurant",
            address: "Website Address",
          },
          menu: [],
          confidence: 0.9,
        },
        {
          source: "google_business",
          sourceUrl: "https://google.com/maps/place/test",
          scrapedAt: new Date(),
          restaurant: {
            address: "Google Address",
            city: "San Francisco",
            state: "CA",
          },
          menu: [],
          confidence: 0.95,
        },
      ];

      const result = mergeStrategy.merge(extractedData);

      // Google should be preferred for address
      expect(result.restaurant.address).toBe("Google Address");
      expect(result.restaurant._sources.address).toBe("google_business");

      // Website should be used for name (Google didn't have it)
      expect(result.restaurant.name).toBe("Test Restaurant");
    });

    it("should merge menu items from multiple sources", () => {
      const extractedData: ExtractedData[] = [
        {
          source: "website",
          sourceUrl: "https://example.com",
          scrapedAt: new Date(),
          restaurant: {},
          menu: [
            {
              name: "Appetizers",
              items: [
                { name: "Spring Rolls", price: 8.99 },
                { name: "Soup", price: 6.99 },
              ],
            },
          ],
          confidence: 0.9,
        },
        {
          source: "doordash",
          sourceUrl: "https://doordash.com/store/test",
          scrapedAt: new Date(),
          restaurant: {},
          menu: [
            {
              name: "Appetizers",
              items: [
                { name: "Spring Rolls", price: 10.99, imageUrl: "https://img.com/rolls.jpg" },
                { name: "Wings", price: 12.99 },
              ],
            },
          ],
          confidence: 0.8,
        },
      ];

      const result = mergeStrategy.merge(extractedData);

      // Should have one merged "Appetizers" category
      expect(result.menu.categories).toHaveLength(1);
      expect(result.menu.categories[0].name).toBe("Appetizers");

      // Should have 3 unique items (Spring Rolls merged, Soup + Wings added)
      const items = result.menu.categories[0].items;
      expect(items).toHaveLength(3);

      // Spring Rolls should use website price
      const springRolls = items.find((i) => i.name === "Spring Rolls");
      expect(springRolls?.price).toBe(8.99);

      // But should have DoorDash image (filled in as missing)
      expect(springRolls?.imageUrl).toBe("https://img.com/rolls.jpg");
    });

    it("should track price variants for warnings", () => {
      const extractedData: ExtractedData[] = [
        {
          source: "website",
          sourceUrl: "https://example.com",
          scrapedAt: new Date(),
          restaurant: {},
          menu: [
            {
              name: "Main",
              items: [{ name: "Burger", price: 12.99 }],
            },
          ],
          confidence: 0.9,
        },
        {
          source: "doordash",
          sourceUrl: "https://doordash.com/store/test",
          scrapedAt: new Date(),
          restaurant: {},
          menu: [
            {
              name: "Main",
              items: [{ name: "Burger", price: 15.99 }],
            },
          ],
          confidence: 0.8,
        },
      ];

      const result = mergeStrategy.merge(extractedData);

      const burger = result.menu.categories[0].items[0];
      expect(burger._priceVariants).toBeDefined();
      expect(burger._priceVariants).toHaveLength(2);
    });

    it("should throw error when no data provided", () => {
      expect(() => mergeStrategy.merge([])).toThrow("No data to merge");
    });
  });

  describe("generateWarnings", () => {
    it("should generate warnings for price discrepancies", () => {
      const extractedData: ExtractedData[] = [
        {
          source: "website",
          sourceUrl: "https://example.com",
          scrapedAt: new Date(),
          restaurant: {},
          menu: [
            {
              name: "Main",
              items: [{ name: "Burger", price: 12.99 }],
            },
          ],
          confidence: 0.9,
        },
        {
          source: "doordash",
          sourceUrl: "https://doordash.com/store/test",
          scrapedAt: new Date(),
          restaurant: {},
          menu: [
            {
              name: "Main",
              items: [{ name: "Burger", price: 15.99 }],
            },
          ],
          confidence: 0.8,
        },
      ];

      const result = mergeStrategy.merge(extractedData);
      const warnings = mergeStrategy.generateWarnings(result);

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("Price difference");
      expect(warnings[0]).toContain("Burger");
    });
  });
});
