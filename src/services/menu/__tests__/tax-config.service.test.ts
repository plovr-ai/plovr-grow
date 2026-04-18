import { describe, it, expect, vi, beforeEach } from "vitest";
import { taxConfigService } from "../tax-config.service";

// Mock repository
vi.mock("@/repositories/tax-config.repository", () => ({
  taxConfigRepository: {
    getTaxConfigsByTenant: vi.fn(),
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
  const service = taxConfigService;

  // Mock data
  const mockTaxConfigs = [
    {
      id: "tax-standard",
      tenantId: "tenant-1",      name: "Standard Tax",
      description: "Standard sales tax",
      roundingMethod: "half_up",
      inclusionType: "additive" as const,
      status: "active",
      deleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "tax-alcohol",
      tenantId: "tenant-1",      name: "Alcohol Tax",
      description: "Additional alcohol tax",
      roundingMethod: "half_up",
      inclusionType: "additive" as const,
      status: "active",
      deleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "tax-reduced",
      tenantId: "tenant-1",      name: "Reduced Tax",
      description: "Reduced rate for groceries",
      roundingMethod: "always_round_down",
      inclusionType: "additive" as const,
      status: "active",
      deleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTaxConfigs", () => {
    it("should return all tax configs for a company", async () => {
      vi.mocked(taxConfigRepository.getTaxConfigsByTenant).mockResolvedValue(
        mockTaxConfigs
      );

      const result = await service.getTaxConfigs("tenant-1");

      expect(taxConfigRepository.getTaxConfigsByTenant).toHaveBeenCalledWith(
        "tenant-1"
      );
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        id: "tax-standard",
        name: "Standard Tax",
        description: "Standard sales tax",
        roundingMethod: "half_up",
        inclusionType: "additive",
        status: "active",
      });
    });

    it("should return empty array when no configs exist", async () => {
      vi.mocked(taxConfigRepository.getTaxConfigsByTenant).mockResolvedValue(
        []
      );

      const result = await service.getTaxConfigs("tenant-1");

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
        inclusionType: "additive",
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
            inclusionType: "additive",
          },
        },
        {
          taxConfigId: "tax-alcohol",
          rate: 0.1,
          taxConfig: {
            name: "Alcohol Tax",
            roundingMethod: "half_up",
            inclusionType: "additive",
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
        inclusionType: "additive",
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

      vi.mocked(taxConfigRepository.getTaxConfigsByTenant).mockResolvedValue(
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
        name: "New Tax",
        description: "A new tax",
        roundingMethod: "half_up",
        inclusionType: "additive" as const,
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

      const result = await service.createTaxConfig("tenant-1", {
        name: "New Tax",
        description: "A new tax",
        roundingMethod: "half_up",
        merchantRates: [{ merchantId: "merchant-1", rate: 0.09 }],
      });

      expect(taxConfigRepository.createTaxConfig).toHaveBeenCalledWith(
        "tenant-1",
        {
          name: "New Tax",
          description: "A new tax",
          roundingMethod: "half_up",
          inclusionType: "additive",
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

      await service.updateTaxConfig("tenant-1", "tax-standard", {
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

  describe("inclusionType propagation", () => {
    it("returns inclusionType in getTaxConfig", async () => {
      const inclusiveConfig = {
        ...mockTaxConfigs[0],
        inclusionType: "inclusive" as const,
      };
      vi.mocked(taxConfigRepository.getTaxConfigById).mockResolvedValue(
        inclusiveConfig
      );

      const result = await service.getTaxConfig("tenant-1", "tax-standard");
      expect(result?.inclusionType).toBe("inclusive");
    });

    it("returns inclusionType in getTaxConfigs list", async () => {
      const inclusiveConfigs = [
        { ...mockTaxConfigs[0], inclusionType: "inclusive" as const },
        { ...mockTaxConfigs[1], inclusionType: "additive" as const },
      ];
      vi.mocked(taxConfigRepository.getTaxConfigsByTenant).mockResolvedValue(
        inclusiveConfigs
      );

      const result = await service.getTaxConfigs("tenant-1");
      expect(result[0].inclusionType).toBe("inclusive");
      expect(result[1].inclusionType).toBe("additive");
    });

    it("returns inclusionType in createTaxConfig", async () => {
      const newConfig = {
        id: "tax-incl",
        tenantId: "tenant-1",
        name: "VAT 10%",
        description: null,
        roundingMethod: "half_up" as const,
        inclusionType: "inclusive" as const,
        status: "active" as const,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(taxConfigRepository.createTaxConfig).mockResolvedValue(newConfig);

      const result = await service.createTaxConfig("tenant-1", {
        name: "VAT 10%",
        inclusionType: "inclusive",
        roundingMethod: "half_up",
      });
      expect(result.inclusionType).toBe("inclusive");
    });

    it("passes inclusionType to repository on createTaxConfig", async () => {
      const newConfig = {
        id: "tax-incl",
        tenantId: "tenant-1",
        name: "VAT 10%",
        description: null,
        roundingMethod: "half_up" as const,
        inclusionType: "inclusive" as const,
        status: "active" as const,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(taxConfigRepository.createTaxConfig).mockResolvedValue(newConfig);

      await service.createTaxConfig("tenant-1", {
        name: "VAT 10%",
        inclusionType: "inclusive",
        roundingMethod: "half_up",
      });
      expect(taxConfigRepository.createTaxConfig).toHaveBeenCalledWith(
        "tenant-1",
        expect.objectContaining({ inclusionType: "inclusive" })
      );
    });

    it("passes inclusionType to repository on updateTaxConfig", async () => {
      vi.mocked(taxConfigRepository.updateTaxConfig).mockResolvedValue({
        count: 1,
      });

      await service.updateTaxConfig("tenant-1", "tax-standard", {
        inclusionType: "inclusive",
      });
      expect(taxConfigRepository.updateTaxConfig).toHaveBeenCalledWith(
        "tenant-1",
        "tax-standard",
        { inclusionType: "inclusive" }
      );
    });

    it("returns inclusionType in getMerchantTaxConfigs", async () => {
      const mockMerchantRates = [
        {
          taxConfigId: "tax-standard",
          rate: 0.1,
          taxConfig: {
            name: "VAT",
            roundingMethod: "half_up",
            inclusionType: "inclusive",
          },
        },
      ];
      vi.mocked(taxConfigRepository.getMerchantTaxRates).mockResolvedValue(
        mockMerchantRates as never
      );

      const result = await service.getMerchantTaxConfigs("merchant-1");
      expect(result[0].inclusionType).toBe("inclusive");
    });
  });

  describe("getTaxConfigInfo", () => {
    it("should return tax config info by ID", async () => {
      vi.mocked(taxConfigRepository.getTaxConfigById).mockResolvedValue(
        mockTaxConfigs[0]
      );

      const result = await service.getTaxConfigInfo("tenant-1", "tax-standard");

      expect(taxConfigRepository.getTaxConfigById).toHaveBeenCalledWith(
        "tenant-1",
        "tax-standard"
      );
      expect(result).toEqual({
        id: "tax-standard",
        name: "Standard Tax",
        description: "Standard sales tax",
        roundingMethod: "half_up",
        inclusionType: "additive",
        status: "active",
      });
    });

    it("should return null when tax config not found", async () => {
      vi.mocked(taxConfigRepository.getTaxConfigById).mockResolvedValue(null);

      const result = await service.getTaxConfigInfo("tenant-1", "non-existent");

      expect(result).toBeNull();
    });
  });

  describe("createTaxConfig without merchantRates", () => {
    it("should create tax config without setting merchant rates", async () => {
      const newConfig = {
        id: "tax-new",
        tenantId: "tenant-1",        name: "Simple Tax",
        description: null,
        roundingMethod: "half_even",
        inclusionType: "additive" as const,
        status: "active",
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(taxConfigRepository.createTaxConfig).mockResolvedValue(newConfig);

      const result = await service.createTaxConfig("tenant-1", {
        name: "Simple Tax",
        roundingMethod: "half_even",
      });

      expect(taxConfigRepository.createTaxConfig).toHaveBeenCalledWith(
        "tenant-1",
        {
          name: "Simple Tax",
          description: undefined,
          roundingMethod: "half_even",
          inclusionType: "additive",
        }
      );
      expect(taxConfigRepository.setMerchantTaxRate).not.toHaveBeenCalled();
      expect(result.name).toBe("Simple Tax");
      expect(result.description).toBeNull();
      expect(result.roundingMethod).toBe("half_even");
    });

    it("should create tax config with empty merchantRates array", async () => {
      const newConfig = {
        id: "tax-new",
        tenantId: "tenant-1",        name: "Empty Rates Tax",
        description: "desc",
        roundingMethod: "always_round_down",
        inclusionType: "additive" as const,
        status: "active",
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(taxConfigRepository.createTaxConfig).mockResolvedValue(newConfig);

      const result = await service.createTaxConfig("tenant-1", {
        name: "Empty Rates Tax",
        description: "desc",
        roundingMethod: "always_round_down",
        merchantRates: [],
      });

      expect(taxConfigRepository.setMerchantTaxRate).not.toHaveBeenCalled();
      expect(result.name).toBe("Empty Rates Tax");
    });
  });

  describe("updateTaxConfig with merchantRates", () => {
    it("should delete old rates and upsert new rates", async () => {
      vi.mocked(taxConfigRepository.updateTaxConfig).mockResolvedValue({
        count: 1,
      });
      vi.mocked(taxConfigRepository.getTaxConfigMerchantRates).mockResolvedValue([
        { merchantId: "merchant-1", taxConfigId: "tax-standard", rate: 0.08, id: "r1", deleted: false, createdAt: new Date(), updatedAt: new Date() },
        { merchantId: "merchant-2", taxConfigId: "tax-standard", rate: 0.09, id: "r2", deleted: false, createdAt: new Date(), updatedAt: new Date() },
      ] as never);
      vi.mocked(taxConfigRepository.deleteMerchantTaxRate).mockResolvedValue(
        undefined as never
      );
      vi.mocked(taxConfigRepository.setMerchantTaxRate).mockResolvedValue({
        id: "mtr-1",
        merchantId: "merchant-1",
        taxConfigId: "tax-standard",
        rate: { toNumber: () => 0.085 } as unknown as import("@prisma/client/runtime/library").Decimal,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.updateTaxConfig("tenant-1", "tax-standard", {
        name: "Updated Tax",
        merchantRates: [
          { merchantId: "merchant-1", rate: 0.085 },
          { merchantId: "merchant-3", rate: 0.10 },
        ],
      });

      // merchant-2 should be deleted (not in new list)
      expect(taxConfigRepository.deleteMerchantTaxRate).toHaveBeenCalledWith(
        "merchant-2",
        "tax-standard"
      );
      // merchant-1 should NOT be deleted (in new list)
      expect(taxConfigRepository.deleteMerchantTaxRate).not.toHaveBeenCalledWith(
        "merchant-1",
        "tax-standard"
      );
      // merchant-1 and merchant-3 should be upserted
      expect(taxConfigRepository.setMerchantTaxRate).toHaveBeenCalledWith(
        "merchant-1",
        "tax-standard",
        0.085
      );
      expect(taxConfigRepository.setMerchantTaxRate).toHaveBeenCalledWith(
        "merchant-3",
        "tax-standard",
        0.10
      );
    });

    it("should skip update when no fields provided", async () => {
      vi.mocked(taxConfigRepository.getTaxConfigMerchantRates).mockResolvedValue(
        []
      );

      await service.updateTaxConfig("tenant-1", "tax-standard", {
        merchantRates: [],
      });

      // No update call since no fields to update
      expect(taxConfigRepository.updateTaxConfig).not.toHaveBeenCalled();
      // No delete calls since no current rates
      expect(taxConfigRepository.deleteMerchantTaxRate).not.toHaveBeenCalled();
      // No set calls since no new rates
      expect(taxConfigRepository.setMerchantTaxRate).not.toHaveBeenCalled();
    });

    it("should not touch merchant rates when merchantRates is undefined", async () => {
      vi.mocked(taxConfigRepository.updateTaxConfig).mockResolvedValue({
        count: 1,
      });

      await service.updateTaxConfig("tenant-1", "tax-standard", {
        status: "inactive",
      });

      expect(taxConfigRepository.updateTaxConfig).toHaveBeenCalledWith(
        "tenant-1",
        "tax-standard",
        { status: "inactive" }
      );
      expect(taxConfigRepository.getTaxConfigMerchantRates).not.toHaveBeenCalled();
      expect(taxConfigRepository.deleteMerchantTaxRate).not.toHaveBeenCalled();
      expect(taxConfigRepository.setMerchantTaxRate).not.toHaveBeenCalled();
    });

    it("should handle update with only description change", async () => {
      vi.mocked(taxConfigRepository.updateTaxConfig).mockResolvedValue({
        count: 1,
      });

      await service.updateTaxConfig("tenant-1", "tax-standard", {
        description: "Updated description",
      });

      expect(taxConfigRepository.updateTaxConfig).toHaveBeenCalledWith(
        "tenant-1",
        "tax-standard",
        { description: "Updated description" }
      );
    });
  });

  describe("getTaxConfigsWithRates edge cases", () => {
    it("should handle empty merchants list", async () => {
      vi.mocked(taxConfigRepository.getTaxConfigsByTenant).mockResolvedValue(
        mockTaxConfigs
      );

      const result = await service.getTaxConfigsWithRates(
        "tenant-1",
                []
      );

      expect(result).toHaveLength(3);
      expect(result[0].merchantRates).toHaveLength(0);
    });

    it("should handle tax config with no rates for any merchant", async () => {
      vi.mocked(taxConfigRepository.getTaxConfigsByTenant).mockResolvedValue([
        mockTaxConfigs[2], // tax-reduced
      ]);
      vi.mocked(taxConfigRepository.getMerchantTaxRateMap).mockResolvedValue(
        new Map() // no rates
      );

      const result = await service.getTaxConfigsWithRates(
        "tenant-1",
                [{ id: "merchant-1", name: "Store 1" }]
      );

      expect(result).toHaveLength(1);
      expect(result[0].merchantRates).toHaveLength(0);
    });
  });
});
