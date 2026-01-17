import { describe, it, expect } from "vitest";
import { merchantService } from "../merchant.service";

describe("MerchantService", () => {
  describe("getCompanyBySlug", () => {
    it("should return company data for valid slug", async () => {
      const company = await merchantService.getCompanyBySlug("joes-pizza");

      expect(company).not.toBeNull();
      expect(company?.id).toBe("company-joes");
      expect(company?.slug).toBe("joes-pizza");
      expect(company?.name).toBe("Joe's Pizza Inc.");
    });

    it("should return company with merchants", async () => {
      const company = await merchantService.getCompanyBySlug("joes-pizza");

      expect(company?.merchants).toBeDefined();
      expect(company?.merchants.length).toBe(2);
      expect(company?.merchants[0].slug).toBe("joes-pizza-downtown");
      expect(company?.merchants[1].slug).toBe("joes-pizza-midtown");
    });

    it("should return company with tenant info", async () => {
      const company = await merchantService.getCompanyBySlug("joes-pizza");

      expect(company?.tenantId).toBe("tenant-joes");
      expect(company?.tenant.id).toBe("tenant-joes");
      expect(company?.tenant.name).toBe("Joe's Pizza");
    });

    it("should return null for non-existent slug", async () => {
      const company = await merchantService.getCompanyBySlug("non-existent-company");

      expect(company).toBeNull();
    });

    it("should return null for empty slug", async () => {
      const company = await merchantService.getCompanyBySlug("");

      expect(company).toBeNull();
    });
  });

  describe("getMerchantBySlug", () => {
    it("should return merchant data for valid slug", async () => {
      const merchant = await merchantService.getMerchantBySlug("joes-pizza-downtown");

      expect(merchant).not.toBeNull();
      expect(merchant?.id).toBe("merchant-joes-downtown");
      expect(merchant?.slug).toBe("joes-pizza-downtown");
      expect(merchant?.name).toBe("Joe's Pizza - Downtown");
    });

    it("should return merchant with address info", async () => {
      const merchant = await merchantService.getMerchantBySlug("joes-pizza-downtown");

      expect(merchant?.address).toBe("123 Main St");
      expect(merchant?.city).toBe("New York");
      expect(merchant?.state).toBe("NY");
      expect(merchant?.phone).toBe("(212) 555-0100");
    });

    it("should return merchant with company info", async () => {
      const merchant = await merchantService.getMerchantBySlug("joes-pizza-downtown");

      expect(merchant?.companyId).toBe("company-joes");
      expect(merchant?.company.slug).toBe("joes-pizza");
      expect(merchant?.company.name).toBe("Joe's Pizza Inc.");
    });

    it("should support legacy single-store slug", async () => {
      const merchant = await merchantService.getMerchantBySlug("joes-pizza");

      expect(merchant).not.toBeNull();
      expect(merchant?.id).toBe("merchant-joes-downtown");
    });

    it("should return different merchants for different slugs", async () => {
      const downtown = await merchantService.getMerchantBySlug("joes-pizza-downtown");
      const midtown = await merchantService.getMerchantBySlug("joes-pizza-midtown");

      expect(downtown?.id).not.toBe(midtown?.id);
      expect(downtown?.name).toBe("Joe's Pizza - Downtown");
      expect(midtown?.name).toBe("Joe's Pizza - Midtown");
    });

    it("should return null for non-existent slug", async () => {
      const merchant = await merchantService.getMerchantBySlug("non-existent-merchant");

      expect(merchant).toBeNull();
    });
  });

  describe("getMerchant (by ID)", () => {
    it("should return merchant data for valid ID", async () => {
      const merchant = await merchantService.getMerchant("merchant-joes-downtown");

      expect(merchant).not.toBeNull();
      expect(merchant?.id).toBe("merchant-joes-downtown");
      expect(merchant?.slug).toBe("joes-pizza-downtown");
    });

    it("should return null for non-existent ID", async () => {
      const merchant = await merchantService.getMerchant("non-existent-id");

      expect(merchant).toBeNull();
    });
  });

  describe("getTaxRate", () => {
    it("should return tax rate for valid merchant", async () => {
      const taxRate = await merchantService.getTaxRate("merchant-joes-downtown");

      expect(taxRate).toBe(0.08875);
    });

    it("should return 0 for non-existent merchant", async () => {
      const taxRate = await merchantService.getTaxRate("non-existent-id");

      expect(taxRate).toBe(0);
    });
  });

  describe("isOpen", () => {
    it("should return true for active merchant", async () => {
      const isOpen = await merchantService.isOpen("merchant-joes-downtown");

      expect(isOpen).toBe(true);
    });

    it("should return false for non-existent merchant", async () => {
      const isOpen = await merchantService.isOpen("non-existent-id");

      expect(isOpen).toBe(false);
    });
  });

  describe("isSlugAvailable", () => {
    it("should return false for existing slug", async () => {
      const available = await merchantService.isSlugAvailable("joes-pizza-downtown");

      expect(available).toBe(false);
    });

    it("should return true for non-existing slug", async () => {
      const available = await merchantService.isSlugAvailable("new-restaurant");

      expect(available).toBe(true);
    });

    it("should return true when checking own slug with exclusion", async () => {
      const available = await merchantService.isSlugAvailable(
        "joes-pizza-downtown",
        "merchant-joes-downtown"
      );

      expect(available).toBe(true);
    });
  });
});
