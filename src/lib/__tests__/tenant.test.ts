import { describe, it, expect } from "vitest";
import {
  getCompanyBySlug,
  getMerchantBySlug,
  extractCompanySlugFromPath,
  extractMerchantSlugFromPath,
} from "../tenant";

describe("tenant utilities", () => {
  describe("getCompanyBySlug", () => {
    it("should return company data for valid slug", async () => {
      const company = await getCompanyBySlug("joes-pizza");

      expect(company).not.toBeNull();
      expect(company?.id).toBe("company-joes");
      expect(company?.slug).toBe("joes-pizza");
      expect(company?.name).toBe("Joe's Pizza Inc.");
    });

    it("should return company with merchants", async () => {
      const company = await getCompanyBySlug("joes-pizza");

      expect(company?.merchants).toBeDefined();
      expect(company?.merchants.length).toBe(2);
      expect(company?.merchants[0].slug).toBe("joes-pizza-downtown");
      expect(company?.merchants[1].slug).toBe("joes-pizza-midtown");
    });

    it("should return company with tenant info", async () => {
      const company = await getCompanyBySlug("joes-pizza");

      expect(company?.tenantId).toBe("tenant-joes");
      expect(company?.tenant.id).toBe("tenant-joes");
      expect(company?.tenant.name).toBe("Joe's Pizza");
    });

    it("should return null for non-existent slug", async () => {
      const company = await getCompanyBySlug("non-existent-company");

      expect(company).toBeNull();
    });

    it("should return null for empty slug", async () => {
      const company = await getCompanyBySlug("");

      expect(company).toBeNull();
    });
  });

  describe("getMerchantBySlug", () => {
    it("should return merchant data for valid slug", async () => {
      const merchant = await getMerchantBySlug("joes-pizza-downtown");

      expect(merchant).not.toBeNull();
      expect(merchant?.id).toBe("merchant-joes-downtown");
      expect(merchant?.slug).toBe("joes-pizza-downtown");
      expect(merchant?.name).toBe("Joe's Pizza - Downtown");
    });

    it("should return merchant with address info", async () => {
      const merchant = await getMerchantBySlug("joes-pizza-downtown");

      expect(merchant?.address).toBe("123 Main St");
      expect(merchant?.city).toBe("New York");
      expect(merchant?.state).toBe("NY");
      expect(merchant?.phone).toBe("(212) 555-0100");
    });

    it("should return merchant with company info", async () => {
      const merchant = await getMerchantBySlug("joes-pizza-downtown");

      expect(merchant?.companyId).toBe("company-joes");
      expect(merchant?.company.slug).toBe("joes-pizza");
      expect(merchant?.company.name).toBe("Joe's Pizza Inc.");
    });

    it("should support legacy single-store slug", async () => {
      const merchant = await getMerchantBySlug("joes-pizza");

      expect(merchant).not.toBeNull();
      expect(merchant?.id).toBe("merchant-joes-downtown");
    });

    it("should return different merchants for different slugs", async () => {
      const downtown = await getMerchantBySlug("joes-pizza-downtown");
      const midtown = await getMerchantBySlug("joes-pizza-midtown");

      expect(downtown?.id).not.toBe(midtown?.id);
      expect(downtown?.name).toBe("Joe's Pizza - Downtown");
      expect(midtown?.name).toBe("Joe's Pizza - Midtown");
    });

    it("should return null for non-existent slug", async () => {
      const merchant = await getMerchantBySlug("non-existent-merchant");

      expect(merchant).toBeNull();
    });
  });

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
