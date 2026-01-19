import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaxConfigService } from "../tax-config.service";

// Mock repository
vi.mock("@/repositories/tax-config.repository", () => ({
  taxConfigRepository: {
    getTaxConfigsByCompany: vi.fn(),
    getTaxConfigById: vi.fn(),
    getTaxConfigsByIds: vi.fn(),
    getDefaultTaxConfig: vi.fn(),
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
      isDefault: true,
      status: "active",
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
      isDefault: false,
      status: "active",
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
      isDefault: false,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TaxConfigService();
  });

  describe("getTaxConfigsForMerchant", () => {
    it("should return tax configs with merchant-specific rates", async () => {
      const rateMap = new Map([
        ["tax-standard", 0.0825],
        ["tax-alcohol", 0.1],
      ]);

      vi.mocked(taxConfigRepository.getTaxConfigsByCompany).mockResolvedValue(
        mockTaxConfigs
      );
      vi.mocked(taxConfigRepository.getMerchantTaxRateMap).mockResolvedValue(
        rateMap
      );

      const result = await service.getTaxConfigsForMerchant(
        "tenant-1",
        "company-1",
        "merchant-1"
      );

      expect(taxConfigRepository.getTaxConfigsByCompany).toHaveBeenCalledWith(
        "tenant-1",
        "company-1"
      );
      expect(taxConfigRepository.getMerchantTaxRateMap).toHaveBeenCalledWith(
        "merchant-1"
      );
      // Only returns configs that have rates for this merchant
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "tax-standard",
        name: "Standard Tax",
        rate: 0.0825,
        roundingMethod: "half_up",
        isDefault: true,
        status: "active",
      });
    });

    it("should return empty array when no merchant rates configured", async () => {
      vi.mocked(taxConfigRepository.getTaxConfigsByCompany).mockResolvedValue(
        mockTaxConfigs
      );
      vi.mocked(taxConfigRepository.getMerchantTaxRateMap).mockResolvedValue(
        new Map()
      );

      const result = await service.getTaxConfigsForMerchant(
        "tenant-1",
        "company-1",
        "merchant-1"
      );

      expect(result).toHaveLength(0);
    });
  });

  describe("getTaxConfig", () => {
    it("should return a single tax config with merchant-specific rate", async () => {
      const rateMap = new Map([["tax-standard", 0.0825]]);

      vi.mocked(taxConfigRepository.getTaxConfigById).mockResolvedValue(
        mockTaxConfigs[0]
      );
      vi.mocked(taxConfigRepository.getMerchantTaxRateMap).mockResolvedValue(
        rateMap
      );

      const result = await service.getTaxConfig(
        "tenant-1",
        "tax-standard",
        "merchant-1"
      );

      expect(taxConfigRepository.getTaxConfigById).toHaveBeenCalledWith(
        "tenant-1",
        "tax-standard"
      );
      expect(result).toEqual({
        id: "tax-standard",
        name: "Standard Tax",
        rate: 0.0825,
        roundingMethod: "half_up",
        isDefault: true,
        status: "active",
      });
    });

    it("should return null when tax config not found", async () => {
      vi.mocked(taxConfigRepository.getTaxConfigById).mockResolvedValue(null);
      vi.mocked(taxConfigRepository.getMerchantTaxRateMap).mockResolvedValue(
        new Map()
      );

      const result = await service.getTaxConfig(
        "tenant-1",
        "non-existent",
        "merchant-1"
      );

      expect(result).toBeNull();
    });
  });

  describe("getTaxConfigsMap", () => {
    it("should return a map of tax configs with merchant rates", async () => {
      const rateMap = new Map([
        ["tax-standard", 0.0825],
        ["tax-alcohol", 0.1],
      ]);

      vi.mocked(taxConfigRepository.getTaxConfigsByIds).mockResolvedValue([
        mockTaxConfigs[0],
        mockTaxConfigs[1],
      ]);
      vi.mocked(taxConfigRepository.getMerchantTaxRateMap).mockResolvedValue(
        rateMap
      );

      const result = await service.getTaxConfigsMap(
        "tenant-1",
        ["tax-standard", "tax-alcohol"],
        "merchant-1"
      );

      expect(taxConfigRepository.getTaxConfigsByIds).toHaveBeenCalledWith(
        "tenant-1",
        ["tax-standard", "tax-alcohol"]
      );
      expect(result.size).toBe(2);
      expect(result.get("tax-standard")?.rate).toBe(0.0825);
      expect(result.get("tax-alcohol")?.rate).toBe(0.1);
    });
  });

  describe("getDefaultTaxConfig", () => {
    it("should return the default tax config with merchant rate", async () => {
      const rateMap = new Map([["tax-standard", 0.0825]]);

      vi.mocked(taxConfigRepository.getDefaultTaxConfig).mockResolvedValue(
        mockTaxConfigs[0]
      );
      vi.mocked(taxConfigRepository.getMerchantTaxRateMap).mockResolvedValue(
        rateMap
      );

      const result = await service.getDefaultTaxConfig(
        "tenant-1",
        "company-1",
        "merchant-1"
      );

      expect(taxConfigRepository.getDefaultTaxConfig).toHaveBeenCalledWith(
        "tenant-1",
        "company-1"
      );
      expect(result?.isDefault).toBe(true);
      expect(result?.rate).toBe(0.0825);
    });

    it("should return null when no default config exists", async () => {
      vi.mocked(taxConfigRepository.getDefaultTaxConfig).mockResolvedValue(null);
      vi.mocked(taxConfigRepository.getMerchantTaxRateMap).mockResolvedValue(
        new Map()
      );

      const result = await service.getDefaultTaxConfig(
        "tenant-1",
        "company-1",
        "merchant-1"
      );

      expect(result).toBeNull();
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
        isDefault: false,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(taxConfigRepository.getDefaultTaxConfig).mockResolvedValue(null);
      vi.mocked(taxConfigRepository.createTaxConfig).mockResolvedValue(newConfig);
      vi.mocked(taxConfigRepository.setMerchantTaxRate).mockResolvedValue({
        id: "mtr-1",
        merchantId: "merchant-1",
        taxConfigId: "tax-new",
        rate: { toNumber: () => 0.09 } as unknown as import("@prisma/client/runtime/library").Decimal,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createTaxConfig("tenant-1", "company-1", {
        name: "New Tax",
        description: "A new tax",
        roundingMethod: "half_up",
        isDefault: false,
        merchantRates: [{ merchantId: "merchant-1", rate: 0.09 }],
      });

      expect(taxConfigRepository.createTaxConfig).toHaveBeenCalledWith(
        "tenant-1",
        "company-1",
        {
          name: "New Tax",
          description: "A new tax",
          roundingMethod: "half_up",
          isDefault: false,
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
      vi.mocked(taxConfigRepository.getDefaultTaxConfig).mockResolvedValue(null);
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
});
