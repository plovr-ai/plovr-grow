import { describe, it, expect } from "vitest";
import {
  normalizeRestaurantInfo,
  normalizeMenuCategories,
  normalizeMenuItems,
} from "../normalizers/data-normalizer";

describe("Data Normalizer", () => {
  describe("normalizeRestaurantInfo", () => {
    it("should normalize state to 2-letter abbreviation", () => {
      expect(
        normalizeRestaurantInfo({ state: "California" }).state
      ).toBe("CA");
      expect(normalizeRestaurantInfo({ state: "ca" }).state).toBe("CA");
      expect(normalizeRestaurantInfo({ state: "CA" }).state).toBe("CA");
      expect(
        normalizeRestaurantInfo({ state: "New York" }).state
      ).toBe("NY");
    });

    it("should normalize ZIP code to 5 digits", () => {
      expect(
        normalizeRestaurantInfo({ zipCode: "94102" }).zipCode
      ).toBe("94102");
      expect(
        normalizeRestaurantInfo({ zipCode: "94102-1234" }).zipCode
      ).toBe("94102");
      expect(
        normalizeRestaurantInfo({ zipCode: "ZIP: 94102" }).zipCode
      ).toBe("94102");
    });

    it("should normalize phone numbers", () => {
      expect(
        normalizeRestaurantInfo({ phone: "4155551234" }).phone
      ).toBe("(415) 555-1234");
      expect(
        normalizeRestaurantInfo({ phone: "14155551234" }).phone
      ).toBe("(415) 555-1234");
      expect(
        normalizeRestaurantInfo({ phone: "(415) 555-1234" }).phone
      ).toBe("(415) 555-1234");
      expect(
        normalizeRestaurantInfo({ phone: "415.555.1234" }).phone
      ).toBe("(415) 555-1234");
    });

    it("should normalize email to lowercase", () => {
      expect(
        normalizeRestaurantInfo({ email: "Test@Example.COM" }).email
      ).toBe("test@example.com");
    });

    it("should handle missing URL protocol", () => {
      expect(
        normalizeRestaurantInfo({ logoUrl: "//example.com/logo.png" }).logoUrl
      ).toBe("https://example.com/logo.png");
      expect(
        normalizeRestaurantInfo({ logoUrl: "example.com/logo.png" }).logoUrl
      ).toBe("https://example.com/logo.png");
    });

    it("should trim whitespace from strings", () => {
      expect(
        normalizeRestaurantInfo({ name: "  Test Restaurant  " }).name
      ).toBe("Test Restaurant");
      expect(
        normalizeRestaurantInfo({ address: "  123 Main St  " }).address
      ).toBe("123 Main St");
    });
  });

  describe("normalizeMenuCategories", () => {
    it("should filter out categories with no name or items", () => {
      const categories = [
        { name: "Appetizers", items: [{ name: "Spring Rolls", price: 8.99 }] },
        { name: "", items: [{ name: "Test", price: 5.99 }] },
        { name: "Empty", items: [] },
      ];

      const result = normalizeMenuCategories(categories);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Appetizers");
    });

    it("should normalize category names", () => {
      const categories = [
        { name: "  Appetizers  ", items: [{ name: "Test", price: 5.99 }] },
      ];

      const result = normalizeMenuCategories(categories);
      expect(result[0].name).toBe("Appetizers");
    });
  });

  describe("normalizeMenuItems", () => {
    it("should filter out items with no name or negative price", () => {
      const items = [
        { name: "Valid Item", price: 10.99 },
        { name: "", price: 5.99 },
        { name: "Invalid Price", price: -1 },
      ];

      const result = normalizeMenuItems(items);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Valid Item");
    });

    it("should normalize price to 2 decimal places", () => {
      const items = [
        { name: "Test", price: 10.999 },
        { name: "Test2", price: 10.991 },
      ];

      const result = normalizeMenuItems(items);
      expect(result[0].price).toBe(11);
      expect(result[1].price).toBe(10.99);
    });

    it("should lowercase tags", () => {
      const items = [
        { name: "Test", price: 10.99, tags: ["VEGETARIAN", "Gluten-Free"] },
      ];

      const result = normalizeMenuItems(items);
      expect(result[0].tags).toEqual(["vegetarian", "gluten-free"]);
    });

    it("should normalize modifier prices", () => {
      const items = [
        {
          name: "Test",
          price: 10.99,
          modifiers: [
            {
              name: "Size",
              type: "single" as const,
              required: true,
              options: [
                { name: "Small", price: 0 },
                { name: "Large", price: 2.999 },
              ],
            },
          ],
        },
      ];

      const result = normalizeMenuItems(items);
      expect(result[0].modifiers?.[0].options[1].price).toBe(3);
    });
  });
});
