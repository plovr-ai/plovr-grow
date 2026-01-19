import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaxConfigService } from "../tax-config.service";
import { Decimal } from "@prisma/client/runtime/library";

// Mock repository
vi.mock("@/repositories/tax-config.repository", () => ({
  taxConfigRepository: {
    getTaxConfigsByCompany: vi.fn(),
    getTaxConfigById: vi.fn(),
    getTaxConfigsByIds: vi.fn(),
    getDefaultTaxConfig: vi.fn(),
    getMerchantTaxRates: vi.fn(),
    getMerchantTaxRateMap: vi.fn(),
    createTaxConfig: vi.fn(),
    updateTaxConfig: vi.fn(),
    setMerchantTaxRate: vi.fn(),
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

  const mockMerchantTaxRates = [
    {
      id: "mtr-1",
      merchantId: "merchant-1",
      taxConfigId: "tax-standard",
      rate: new Decimal(0.0825),
      createdAt: new Date(),
      updatedAt: new Date(),
      taxConfig: mockTaxConfigs[0],
    },
    {
      id: "mtr-2",
      merchantId: "merchant-1",
      taxConfigId: "tax-alcohol",
      rate: new Decimal(0.1),
      createdAt: new Date(),
      updatedAt: new Date(),
      taxConfig: mockTaxConfigs[1],
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
        isDefault: true,
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
        isDefault: true,
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
    it("should return a map of tax configs by ID", async () => {
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

    it("should return empty map for empty IDs array", async () => {
      vi.mocked(taxConfigRepository.getTaxConfigsByIds).mockResolvedValue([]);

      const result = await service.getTaxConfigsMap("tenant-1", []);

      expect(result.size).toBe(0);
    });
  });

  describe("getDefaultTaxConfig", () => {
    it("should return the default tax config for a company", async () => {
      vi.mocked(taxConfigRepository.getDefaultTaxConfig).mockResolvedValue(
        mockTaxConfigs[0]
      );

      const result = await service.getDefaultTaxConfig("tenant-1", "company-1");

      expect(taxConfigRepository.getDefaultTaxConfig).toHaveBeenCalledWith(
        "tenant-1",
        "company-1"
      );
      expect(result?.isDefault).toBe(true);
    });

    it("should return null when no default config exists", async () => {
      vi.mocked(taxConfigRepository.getDefaultTaxConfig).mockResolvedValue(
        null
      );

      const result = await service.getDefaultTaxConfig("tenant-1", "company-1");

      expect(result).toBeNull();
    });
  });

  describe("getMerchantTaxConfigs", () => {
    it("should return merchant tax configs with rates", async () => {
      vi.mocked(taxConfigRepository.getMerchantTaxRates).mockResolvedValue(
        mockMerchantTaxRates
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
      expect(result[1]).toEqual({
        id: "tax-alcohol",
        name: "Alcohol Tax",
        rate: 0.1,
        roundingMethod: "half_up",
      });
    });

    it("should return empty array when no rates configured", async () => {
      vi.mocked(taxConfigRepository.getMerchantTaxRates).mockResolvedValue([]);

      const result = await service.getMerchantTaxConfigs("merchant-1");

      expect(result).toHaveLength(0);
    });
  });

  describe("createTaxConfig", () => {
    it("should create a new tax config", async () => {
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

      vi.mocked(taxConfigRepository.createTaxConfig).mockResolvedValue(
        newConfig
      );

      const result = await service.createTaxConfig("tenant-1", "company-1", {
        name: "New Tax",
        description: "A new tax",
        roundingMethod: "half_up",
        isDefault: false,
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
      expect(result.name).toBe("New Tax");
    });
  });

  describe("updateTaxConfig", () => {
    it("should update a tax config", async () => {
      vi.mocked(taxConfigRepository.updateTaxConfig).mockResolvedValue({
        count: 1,
      });

      await service.updateTaxConfig("tenant-1", "tax-standard", {
        name: "Updated Tax",
        roundingMethod: "always_round_up",
      });

      expect(taxConfigRepository.updateTaxConfig).toHaveBeenCalledWith(
        "tenant-1",
        "tax-standard",
        {
          name: "Updated Tax",
          description: undefined,
          roundingMethod: "always_round_up",
          isDefault: undefined,
          status: undefined,
        }
      );
    });
  });

  describe("setMerchantTaxRate", () => {
    it("should set tax rate for a merchant", async () => {
      vi.mocked(taxConfigRepository.setMerchantTaxRate).mockResolvedValue({
        id: "mtr-new",
        merchantId: "merchant-1",
        taxConfigId: "tax-standard",
        rate: new Decimal(0.09),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.setMerchantTaxRate("merchant-1", "tax-standard", 0.09);

      expect(taxConfigRepository.setMerchantTaxRate).toHaveBeenCalledWith(
        "merchant-1",
        "tax-standard",
        0.09
      );
    });
  });

  describe("setMenuItemTaxConfigs", () => {
    it("should set tax configs for a menu item", async () => {
      vi.mocked(taxConfigRepository.setMenuItemTaxConfigs).mockResolvedValue(
        undefined
      );

      await service.setMenuItemTaxConfigs("item-1", [
        "tax-standard",
        "tax-alcohol",
      ]);

      expect(taxConfigRepository.setMenuItemTaxConfigs).toHaveBeenCalledWith(
        "item-1",
        ["tax-standard", "tax-alcohol"]
      );
    });
  });
});
