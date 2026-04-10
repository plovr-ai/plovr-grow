import { describe, it, expect } from "vitest";
import { merchantService } from "../merchant.service";

// These are integration tests that require database seed data
// Run with: npm run db:seed && npm run test:run
describe.skip("MerchantService (integration)", () => {
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

      expect(merchant?.company.id).toBe("company-joes");
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

  // Note: getMerchant now requires tenantId for tenant isolation
  // These tests need database or mocked repository to work properly
  describe.skip("getMerchant (by ID)", () => {
    it("should return merchant data for valid ID", async () => {
      const merchant = await merchantService.getMerchant(
        "tenant-joes",
        "merchant-joes-downtown"
      );

      expect(merchant).not.toBeNull();
      expect(merchant?.id).toBe("merchant-joes-downtown");
      expect(merchant?.slug).toBe("joes-pizza-downtown");
    });

    it("should return null for non-existent ID", async () => {
      const merchant = await merchantService.getMerchant(
        "tenant-joes",
        "non-existent-id"
      );

      expect(merchant).toBeNull();
    });

    it("should return null when tenantId does not match", async () => {
      const merchant = await merchantService.getMerchant(
        "wrong-tenant",
        "merchant-joes-downtown"
      );

      expect(merchant).toBeNull();
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

  describe("merchant settings", () => {
    it("should return merchant with settings", async () => {
      const merchant = await merchantService.getMerchantBySlug("joes-pizza-downtown");

      expect(merchant?.settings).toBeDefined();
    });

    it("should return settings with tipConfig", async () => {
      const merchant = await merchantService.getMerchantBySlug("joes-pizza-downtown");

      expect(merchant?.settings?.tipConfig).toBeDefined();
      expect(merchant?.settings?.tipConfig?.mode).toBe("percentage");
      expect(merchant?.settings?.tipConfig?.tiers).toEqual([0.15, 0.18, 0.2]);
      expect(merchant?.settings?.tipConfig?.allowCustom).toBe(true);
    });

    it("should return settings with feeConfig", async () => {
      const merchant = await merchantService.getMerchantBySlug("joes-pizza-downtown");

      expect(merchant?.settings?.feeConfig).toBeDefined();
      expect(merchant?.settings?.feeConfig?.fees).toHaveLength(1);
    });

    it("should return service fee with correct values", async () => {
      const merchant = await merchantService.getMerchantBySlug("joes-pizza-downtown");
      const serviceFee = merchant?.settings?.feeConfig?.fees[0];

      expect(serviceFee?.id).toBe("service-fee");
      expect(serviceFee?.name).toBe("service_fee");
      expect(serviceFee?.displayName).toBe("Service Fee");
      expect(serviceFee?.type).toBe("percentage");
      expect(serviceFee?.value).toBe(0.03);
    });

    it("should return settings with pickup and delivery options", async () => {
      const merchant = await merchantService.getMerchantBySlug("joes-pizza-downtown");

      expect(merchant?.settings?.acceptsPickup).toBe(true);
      expect(merchant?.settings?.acceptsDelivery).toBe(true);
    });

    it("should return same settings for all merchants", async () => {
      const downtown = await merchantService.getMerchantBySlug("joes-pizza-downtown");
      const midtown = await merchantService.getMerchantBySlug("joes-pizza-midtown");

      expect(downtown?.settings?.feeConfig?.fees[0].value).toBe(
        midtown?.settings?.feeConfig?.fees[0].value
      );
    });
  });
});
