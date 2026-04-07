import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaxConfigService } from "../tax-config.service";

// Mock repository
vi.mock("@/repositories/tax-config.repository", () => ({
  taxConfigRepository: {
    getTaxConfigsByCompany: vi.fn(),
    getTaxConfigById: vi.fn(),
    getTaxConfigsByIds: vi.fn(),
    getMerchantTaxRates: vi.fn(),
    getMerchantTaxRateMap: vi.fn(),
    getTaxConfigMerchantRates: vi.fn(),
    createTaxConfig: vi.fn(),
    updateTaxConfig: vi.fn(),
    deleteTaxConfig: vi.fn(),
    setMerchantTaxRate: vi.fn(),
    deleteMerchantTaxRate: vi.fn(),
    setMenuItemTaxConfigs: vi.fn(),
  },
}));

import { taxConfigRepository } from "@/repositories/tax-config.repository";

describe("TaxConfigService", () => {
  let service: TaxConfigService;

  // Mock data
  const mockTaxConfigs = [
    {
      id: "tax-standard",
      tenantId: "tenant-1",
      companyId: "company-1",
      name: "Standard Tax",
      description: "Standard sales tax",
      roundingMethod: "half_up",
      status: "active",
      deleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "tax-alcohol",
      tenantId: "tenant-1",
      companyId: "company-1",
      name: "Alcohol Tax",
      description: "Additional alcohol tax",
      roundingMethod: "half_up",
      status: "active",
      deleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "tax-reduced",
      tenantId: "tenant-1",
      companyId: "company-1",
      name: "Reduced Tax",
      description: "Reduced rate for groceries",
      roundingMethod: "always_round_down",
      status: "active",
      deleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TaxConfigService();
  });

  describe("getTaxConfigs", () => {
    it("should return all tax configs for a company", async () => {
      vi.mocked(taxConfigRepository.getTaxConfigsByCompany).mockResolvedValue(
        mockTaxConfigs
      );

      const result = await service.getTaxConfigs("tenant-1", "company-1");

      expect(taxConfigRepository.getTaxConfigsByCompany).toHaveBeenCalledWith(
        "tenant-1",
        "company-1"
      );
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        id: "tax-standard",
        name: "Standard Tax",
        description: "Standard sales tax",
        roundingMethod: "half_up",
        status: "active",
      });
    });

    it("should return empty array when no configs exist", async () => {
      vi.mocked(taxConfigRepository.getTaxConfigsByCompany).mockResolvedValue(
        []
      );

      const result = await service.getTaxConfigs("tenant-1", "company-1");

      expect(result).toHaveLength(0);
    });
  });

  describe("getTaxConfig", () => {
    it("should return a single tax config by ID", async () => {
      vi.mocked(taxConfigRepository.getTaxConfigById).mockResolvedValue(
        mockTaxConfigs[0]
      );

      const result = await service.getTaxConfig("tenant-1", "tax-standard");

      expect(taxConfigRepository.getTaxConfigById).toHaveBeenCalledWith(
        "tenant-1",
        "tax-standard"
      );
      expect(result).toEqual({
        id: "tax-standard",
        name: "Standard Tax",
        description: "Standard sales tax",
        roundingMethod: "half_up",
        status: "active",
      });
    });

    it("should return null when tax config not found", async () => {
      vi.mocked(taxConfigRepository.getTaxConfigById).mockResolvedValue(null);

      const result = await service.getTaxConfig("tenant-1", "non-existent");

      expect(result).toBeNull();
    });
  });

  describe("getTaxConfigsMap", () => {
    it("should return a map of tax configs", async () => {
      vi.mocked(taxConfigRepository.getTaxConfigsByIds).mockResolvedValue([
        mockTaxConfigs[0],
        mockTaxConfigs[1],
      ]);

      const result = await service.getTaxConfigsMap("tenant-1", [
        "tax-standard",
        "tax-alcohol",
      ]);

      expect(taxConfigRepository.getTaxConfigsByIds).toHaveBeenCalledWith(
        "tenant-1",
        ["tax-standard", "tax-alcohol"]
      );
      expect(result.size).toBe(2);
      expect(result.get("tax-standard")?.name).toBe("Standard Tax");
      expect(result.get("tax-alcohol")?.name).toBe("Alcohol Tax");
    });
  });

  describe("getMerchantTaxConfigs", () => {
    it("should return merchant tax configs with rates", async () => {
      // Prisma Decimal is converted to number via Number()
      const mockMerchantRates = [
        {
          taxConfigId: "tax-standard",
          rate: 0.0825,
          taxConfig: {
            name: "Standard Tax",
            roundingMethod: "half_up",
          },
        },
        {
          taxConfigId: "tax-alcohol",
          rate: 0.1,
          taxConfig: {
            name: "Alcohol Tax",
            roundingMethod: "half_up",
          },
        },
      ];

      vi.mocked(taxConfigRepository.getMerchantTaxRates).mockResolvedValue(
        mockMerchantRates as never
      );

      const result = await service.getMerchantTaxConfigs("merchant-1");

      expect(taxConfigRepository.getMerchantTaxRates).toHaveBeenCalledWith(
        "merchant-1"
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "tax-standard",
        name: "Standard Tax",
        rate: 0.0825,
        roundingMethod: "half_up",
      });
    });
  });

  describe("getTaxConfigsWithRates", () => {
    it("should return tax configs with all merchant rates", async () => {
      const merchant1Rates = new Map([["tax-standard", 0.0825]]);
      const merchant2Rates = new Map([
        ["tax-standard", 0.085],
        ["tax-alcohol", 0.1],
      ]);

      vi.mocked(taxConfigRepository.getTaxConfigsByCompany).mockResolvedValue(
        mockTaxConfigs
      );
      vi.mocked(taxConfigRepository.getMerchantTaxRateMap)
        .mockResolvedValueOnce(merchant1Rates)
        .mockResolvedValueOnce(merchant2Rates);

      const merchants = [
        { id: "merchant-1", name: "Store 1" },
        { id: "merchant-2", name: "Store 2" },
      ];

      const result = await service.getTaxConfigsWithRates(
        "tenant-1",
        "company-1",
        merchants
      );

      expect(result).toHaveLength(3);
      expect(result[0].merchantRates).toHaveLength(2); // tax-standard has rates for both merchants
      expect(result[1].merchantRates).toHaveLength(1); // tax-alcohol only has rate for merchant-2
    });
  });

  describe("createTaxConfig", () => {
    it("should create a new tax config with merchant rates", async () => {
      const newConfig = {
        id: "tax-new",
        tenantId: "tenant-1",
        companyId: "company-1",
        name: "New Tax",
        description: "A new tax",
        roundingMethod: "half_up",
        status: "active",
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(taxConfigRepository.createTaxConfig).mockResolvedValue(newConfig);
      vi.mocked(taxConfigRepository.setMerchantTaxRate).mockResolvedValue({
        id: "mtr-1",
        merchantId: "merchant-1",
        taxConfigId: "tax-new",
        rate: { toNumber: () => 0.09 } as unknown as import("@prisma/client/runtime/library").Decimal,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createTaxConfig("tenant-1", "company-1", {
        name: "New Tax",
        description: "A new tax",
        roundingMethod: "half_up",
        merchantRates: [{ merchantId: "merchant-1", rate: 0.09 }],
      });

      expect(taxConfigRepository.createTaxConfig).toHaveBeenCalledWith(
        "tenant-1",
        "company-1",
        {
          name: "New Tax",
          description: "A new tax",
          roundingMethod: "half_up",
        }
      );
      expect(taxConfigRepository.setMerchantTaxRate).toHaveBeenCalledWith(
        "merchant-1",
        "tax-new",
        0.09
      );
      expect(result.name).toBe("New Tax");
    });
  });

  describe("updateTaxConfig", () => {
    it("should update a tax config", async () => {
      vi.mocked(taxConfigRepository.updateTaxConfig).mockResolvedValue({
        count: 1,
      });
      vi.mocked(taxConfigRepository.getTaxConfigMerchantRates).mockResolvedValue(
        []
      );

      await service.updateTaxConfig("tenant-1", "company-1", "tax-standard", {
        name: "Updated Tax",
        roundingMethod: "always_round_up",
      });

      expect(taxConfigRepository.updateTaxConfig).toHaveBeenCalledWith(
        "tenant-1",
        "tax-standard",
        {
          name: "Updated Tax",
          roundingMethod: "always_round_up",
        }
      );
    });
  });

  describe("deleteTaxConfig", () => {
    it("should soft delete a tax config", async () => {
      vi.mocked(taxConfigRepository.deleteTaxConfig).mockResolvedValue({
        count: 1,
      });

      await service.deleteTaxConfig("tenant-1", "tax-standard");

      expect(taxConfigRepository.deleteTaxConfig).toHaveBeenCalledWith(
        "tenant-1",
        "tax-standard"
      );
    });
  });

  describe("setMerchantTaxRate", () => {
    it("should set a merchant tax rate", async () => {
      vi.mocked(taxConfigRepository.setMerchantTaxRate).mockResolvedValue({
        id: "mtr-1",
        merchantId: "merchant-1",
        taxConfigId: "tax-standard",
        rate: { toNumber: () => 0.0825 } as unknown as import("@prisma/client/runtime/library").Decimal,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.setMerchantTaxRate("merchant-1", "tax-standard", 0.0825);

      expect(taxConfigRepository.setMerchantTaxRate).toHaveBeenCalledWith(
        "merchant-1",
        "tax-standard",
        0.0825
      );
    });
  });

  describe("setMenuItemTaxConfigs", () => {
    it("should set tax configs for a menu item", async () => {
      vi.mocked(taxConfigRepository.setMenuItemTaxConfigs).mockResolvedValue(
        undefined
      );

      await service.setMenuItemTaxConfigs("tenant-1", "item-1", [
        "tax-standard",
        "tax-alcohol",
      ]);

      expect(taxConfigRepository.setMenuItemTaxConfigs).toHaveBeenCalledWith(
        "tenant-1",
        "item-1",
        ["tax-standard", "tax-alcohol"]
      );
    });
  });
});
