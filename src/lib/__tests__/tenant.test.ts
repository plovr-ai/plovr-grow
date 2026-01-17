import { describe, it, expect } from "vitest";
import {
  extractCompanySlugFromPath,
  extractMerchantSlugFromPath,
} from "../tenant";

describe("tenant utilities", () => {
  describe("extractCompanySlugFromPath", () => {
    it("should extract company slug from root path", () => {
      expect(extractCompanySlugFromPath("/joes-pizza")).toBe("joes-pizza");
    });

    it("should extract company slug from nested path", () => {
      expect(extractCompanySlugFromPath("/joes-pizza/locations")).toBe(
        "joes-pizza"
      );
    });

    it("should extract company slug from deep nested path", () => {
      expect(extractCompanySlugFromPath("/joes-pizza/locations/123")).toBe(
        "joes-pizza"
      );
    });

    it("should return null for reserved slug: dashboard", () => {
      expect(extractCompanySlugFromPath("/dashboard")).toBeNull();
      expect(extractCompanySlugFromPath("/dashboard/settings")).toBeNull();
    });

    it("should return null for reserved slug: admin", () => {
      expect(extractCompanySlugFromPath("/admin")).toBeNull();
      expect(extractCompanySlugFromPath("/admin/tenants")).toBeNull();
    });

    it("should return null for reserved slug: api", () => {
      expect(extractCompanySlugFromPath("/api")).toBeNull();
      expect(extractCompanySlugFromPath("/api/storefront")).toBeNull();
    });

    it("should return null for reserved slug: r (merchant routes)", () => {
      expect(extractCompanySlugFromPath("/r")).toBeNull();
      expect(extractCompanySlugFromPath("/r/joes-pizza/menu")).toBeNull();
    });

    it("should return null for reserved slug: _next", () => {
      expect(extractCompanySlugFromPath("/_next")).toBeNull();
      expect(extractCompanySlugFromPath("/_next/static")).toBeNull();
    });

    it("should return null for reserved slug: favicon.ico", () => {
      expect(extractCompanySlugFromPath("/favicon.ico")).toBeNull();
    });

    it("should return null for empty path", () => {
      expect(extractCompanySlugFromPath("")).toBeNull();
    });

    it("should return null for root path", () => {
      expect(extractCompanySlugFromPath("/")).toBeNull();
    });
  });

  describe("extractMerchantSlugFromPath", () => {
    it("should extract merchant slug from /r/{slug} path", () => {
      expect(extractMerchantSlugFromPath("/r/joes-pizza")).toBe("joes-pizza");
    });

    it("should extract merchant slug from /r/{slug}/menu path", () => {
      expect(extractMerchantSlugFromPath("/r/joes-pizza/menu")).toBe(
        "joes-pizza"
      );
    });

    it("should extract merchant slug from /r/{slug}/cart path", () => {
      expect(extractMerchantSlugFromPath("/r/joes-pizza-downtown/cart")).toBe(
        "joes-pizza-downtown"
      );
    });

    it("should extract merchant slug from /r/{slug}/checkout path", () => {
      expect(
        extractMerchantSlugFromPath("/r/joes-pizza-midtown/checkout")
      ).toBe("joes-pizza-midtown");
    });

    it("should return null for non-merchant paths", () => {
      expect(extractMerchantSlugFromPath("/joes-pizza")).toBeNull();
      expect(extractMerchantSlugFromPath("/dashboard")).toBeNull();
      expect(extractMerchantSlugFromPath("/admin")).toBeNull();
    });

    it("should return null for path without slug", () => {
      expect(extractMerchantSlugFromPath("/r")).toBeNull();
      expect(extractMerchantSlugFromPath("/r/")).toBeNull();
    });

    it("should return null for empty path", () => {
      expect(extractMerchantSlugFromPath("")).toBeNull();
    });
  });
});
