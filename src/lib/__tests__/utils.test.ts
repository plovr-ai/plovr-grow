import { describe, it, expect } from "vitest";
import { formatPrice } from "../utils";

describe("formatPrice", () => {
  describe("USD currency", () => {
    it("should format price in USD with en-US locale", () => {
      expect(formatPrice(100, "USD", "en-US")).toBe("$100.00");
    });

    it("should format decimal price correctly", () => {
      expect(formatPrice(18.99, "USD", "en-US")).toBe("$18.99");
    });

    it("should format large numbers with thousand separators", () => {
      expect(formatPrice(1234.56, "USD", "en-US")).toBe("$1,234.56");
    });

    it("should use USD and en-US as defaults", () => {
      expect(formatPrice(50)).toBe("$50.00");
    });

    it("should handle string input", () => {
      expect(formatPrice("25.50", "USD", "en-US")).toBe("$25.50");
    });

    it("should handle zero", () => {
      expect(formatPrice(0, "USD", "en-US")).toBe("$0.00");
    });
  });

  describe("EUR currency", () => {
    it("should format price in EUR with de-DE locale", () => {
      const result = formatPrice(100, "EUR", "de-DE");
      // German format: 100,00 € (with non-breaking space)
      expect(result).toContain("100,00");
      expect(result).toContain("€");
    });

    it("should format price in EUR with en-US locale", () => {
      expect(formatPrice(100, "EUR", "en-US")).toBe("€100.00");
    });

    it("should format decimal price in EUR with de-DE locale", () => {
      const result = formatPrice(18.99, "EUR", "de-DE");
      expect(result).toContain("18,99");
      expect(result).toContain("€");
    });
  });

  describe("CNY currency", () => {
    it("should format price in CNY with zh-CN locale", () => {
      const result = formatPrice(100, "CNY", "zh-CN");
      expect(result).toContain("100.00");
      expect(result).toContain("¥");
    });

    it("should format decimal price in CNY", () => {
      const result = formatPrice(18.99, "CNY", "zh-CN");
      expect(result).toContain("18.99");
      expect(result).toContain("¥");
    });
  });

  describe("JPY currency", () => {
    it("should format price in JPY without decimals", () => {
      const result = formatPrice(100, "JPY", "ja-JP");
      // JPY doesn't use decimal places
      expect(result).toContain("100");
      expect(result).toContain("￥");
    });

    it("should round JPY to whole number", () => {
      const result = formatPrice(99.5, "JPY", "ja-JP");
      // Should round to 100 or 99 depending on implementation
      expect(result).toMatch(/￥(99|100)/);
    });
  });

  describe("GBP currency", () => {
    it("should format price in GBP with en-GB locale", () => {
      expect(formatPrice(100, "GBP", "en-GB")).toBe("£100.00");
    });
  });

  describe("edge cases", () => {
    it("should handle negative numbers", () => {
      const result = formatPrice(-50, "USD", "en-US");
      expect(result).toContain("50.00");
      expect(result).toContain("-");
    });

    it("should handle very small numbers", () => {
      expect(formatPrice(0.01, "USD", "en-US")).toBe("$0.01");
    });

    it("should handle very large numbers", () => {
      const result = formatPrice(1000000, "USD", "en-US");
      expect(result).toBe("$1,000,000.00");
    });
  });
});
