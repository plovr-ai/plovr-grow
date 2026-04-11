import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaxConfigRepository } from "../tax-config.repository";

// Mock Prisma client
vi.mock("@/lib/db", () => ({
  default: {
    taxConfig: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    merchantTaxRate: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    menuItemTax: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

import prisma from "@/lib/db";

describe("TaxConfigRepository", () => {
  let repository: TaxConfigRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new TaxConfigRepository();
  });

  describe("getTaxConfigsByTenant", () => {
    it("should return all active tax configs for a company", async () => {
      const mockConfigs = [
        {
          id: "tax-1",
          tenantId: "tenant-1",
          name: "Standard Tax",
          description: "Standard sales tax",
          roundingMethod: "half_up",
          inclusionType: "additive",
          status: "active",
          deleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "tax-2",
          tenantId: "tenant-1",
          name: "Alcohol Tax",
          description: "Additional alcohol tax",
          roundingMethod: "half_up",
          inclusionType: "additive",
          status: "active",
          deleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.taxConfig.findMany).mockResolvedValue(mockConfigs);

      const result = await repository.getTaxConfigsByTenant("tenant-1");

      expect(prisma.taxConfig.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-1",
          status: "active",
          deleted: false,
        },
        orderBy: {
          createdAt: "asc",
        },
      });
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Standard Tax");
    });

    it("should return empty array when no configs exist", async () => {
      vi.mocked(prisma.taxConfig.findMany).mockResolvedValue([]);

      const result = await repository.getTaxConfigsByTenant("tenant-1");

      expect(result).toHaveLength(0);
    });
  });

  describe("getTaxConfigById", () => {
    it("should return a single tax config by ID", async () => {
      const mockConfig = {
        id: "tax-1",
        tenantId: "tenant-1",
        name: "Standard Tax",
        description: "Standard sales tax",
        roundingMethod: "half_up",
        inclusionType: "additive",
        status: "active",
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.taxConfig.findFirst).mockResolvedValue(mockConfig);

      const result = await repository.getTaxConfigById("tenant-1", "tax-1");

      expect(prisma.taxConfig.findFirst).toHaveBeenCalledWith({
        where: {
          id: "tax-1",
          tenantId: "tenant-1",
          deleted: false,
        },
      });
      expect(result?.name).toBe("Standard Tax");
    });

    it("should return null when tax config not found", async () => {
      vi.mocked(prisma.taxConfig.findFirst).mockResolvedValue(null);

      const result = await repository.getTaxConfigById(
        "tenant-1",
        "non-existent"
      );

      expect(result).toBeNull();
    });
  });

  describe("getTaxConfigsByIds", () => {
    it("should return tax configs for given IDs", async () => {
      const mockConfigs = [
        {
          id: "tax-1",
          tenantId: "tenant-1",
          name: "Standard Tax",
          description: null,
          roundingMethod: "half_up",
          inclusionType: "additive",
          status: "active",
          deleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "tax-2",
          tenantId: "tenant-1",
          name: "Alcohol Tax",
          description: null,
          roundingMethod: "half_up",
          inclusionType: "additive",
          status: "active",
          deleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.taxConfig.findMany).mockResolvedValue(mockConfigs);

      const result = await repository.getTaxConfigsByIds("tenant-1", [
        "tax-1",
        "tax-2",
      ]);

      expect(prisma.taxConfig.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ["tax-1", "tax-2"] },
          tenantId: "tenant-1",
          status: "active",
          deleted: false,
        },
      });
      expect(result).toHaveLength(2);
    });

    it("should return empty array for empty IDs array", async () => {
      const result = await repository.getTaxConfigsByIds("tenant-1", []);

      expect(prisma.taxConfig.findMany).not.toHaveBeenCalled();
      expect(result).toHaveLength(0);
    });

    it("defaults to 'additive' when inclusionType is null in DB row (batch path)", async () => {
      const rowWithNullInclusion = {
        id: "tax-legacy",
        tenantId: "tenant-1",
        name: "Legacy Tax",
        description: null,
        roundingMethod: "half_up",
        inclusionType: null,
        status: "active",
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.taxConfig.findMany).mockResolvedValue(
        [rowWithNullInclusion] as unknown as ReturnType<
          typeof prisma.taxConfig.findMany
        > extends Promise<infer T>
          ? T
          : never
      );

      const result = await repository.getTaxConfigsByIds("tenant-1", ["tax-legacy"]);

      expect(result).toHaveLength(1);
      expect(result[0].inclusionType).toBe("additive");
    });
  });

  describe("getMerchantTaxRates", () => {
    it("should return merchant tax rates with tax config details", async () => {
      const mockRates = [
        {
          id: "mtr-1",
          merchantId: "merchant-1",
          taxConfigId: "tax-1",
          rate: { toNumber: () => 0.0825 },
          createdAt: new Date(),
          updatedAt: new Date(),
          taxConfig: {
            id: "tax-1",
            name: "Standard Tax",
            roundingMethod: "half_up",
          },
        },
      ];

      vi.mocked(prisma.merchantTaxRate.findMany).mockResolvedValue(
        mockRates as unknown as ReturnType<
          typeof prisma.merchantTaxRate.findMany
        > extends Promise<infer T>
          ? T
          : never
      );

      const result = await repository.getMerchantTaxRates("merchant-1");

      expect(prisma.merchantTaxRate.findMany).toHaveBeenCalledWith({
        where: {
          merchantId: "merchant-1",
          deleted: false,
        },
        include: {
          taxConfig: true,
        },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe("getMerchantTaxRateMap", () => {
    it("should return a Map of tax config ID to rate", async () => {
      // Prisma Decimal values convert to number via Number() which uses toString()
      const mockRates = [
        {
          taxConfigId: "tax-1",
          rate: { toString: () => "0.0825" },
        },
        {
          taxConfigId: "tax-2",
          rate: { toString: () => "0.1" },
        },
      ];

      vi.mocked(prisma.merchantTaxRate.findMany).mockResolvedValue(
        mockRates as unknown as ReturnType<
          typeof prisma.merchantTaxRate.findMany
        > extends Promise<infer T>
          ? T
          : never
      );

      const result = await repository.getMerchantTaxRateMap("merchant-1");

      expect(prisma.merchantTaxRate.findMany).toHaveBeenCalledWith({
        where: {
          merchantId: "merchant-1",
          deleted: false,
        },
        select: {
          taxConfigId: true,
          rate: true,
        },
      });
      expect(result instanceof Map).toBe(true);
      expect(result.get("tax-1")).toBe(0.0825);
      expect(result.get("tax-2")).toBe(0.1);
    });

    it("should return empty map when no rates configured", async () => {
      vi.mocked(prisma.merchantTaxRate.findMany).mockResolvedValue([]);

      const result = await repository.getMerchantTaxRateMap("merchant-1");

      expect(result.size).toBe(0);
    });
  });

  describe("getMenuItemTaxConfigIds", () => {
    it("should return tax config IDs for a menu item", async () => {
      const mockRelations = [
        { taxConfigId: "tax-1" },
        { taxConfigId: "tax-2" },
      ];

      vi.mocked(prisma.menuItemTax.findMany).mockResolvedValue(
        mockRelations as unknown as ReturnType<
          typeof prisma.menuItemTax.findMany
        > extends Promise<infer T>
          ? T
          : never
      );

      const result = await repository.getMenuItemTaxConfigIds("item-1");

      expect(prisma.menuItemTax.findMany).toHaveBeenCalledWith({
        where: {
          menuItemId: "item-1",
          deleted: false,
        },
        select: {
          taxConfigId: true,
        },
      });
      expect(result).toEqual(["tax-1", "tax-2"]);
    });
  });

  describe("getMenuItemsTaxConfigIds", () => {
    it("should return a Map of item ID to tax config IDs", async () => {
      const mockRelations = [
        { menuItemId: "item-1", taxConfigId: "tax-1" },
        { menuItemId: "item-1", taxConfigId: "tax-2" },
        { menuItemId: "item-2", taxConfigId: "tax-1" },
      ];

      vi.mocked(prisma.menuItemTax.findMany).mockResolvedValue(
        mockRelations as unknown as ReturnType<
          typeof prisma.menuItemTax.findMany
        > extends Promise<infer T>
          ? T
          : never
      );

      const result = await repository.getMenuItemsTaxConfigIds([
        "item-1",
        "item-2",
        "item-3",
      ]);

      expect(prisma.menuItemTax.findMany).toHaveBeenCalledWith({
        where: {
          menuItemId: { in: ["item-1", "item-2", "item-3"] },
          deleted: false,
        },
        select: {
          menuItemId: true,
          taxConfigId: true,
        },
      });
      expect(result instanceof Map).toBe(true);
      expect(result.get("item-1")).toEqual(["tax-1", "tax-2"]);
      expect(result.get("item-2")).toEqual(["tax-1"]);
      expect(result.get("item-3")).toEqual([]); // item-3 has no taxes
    });

    it("should return empty map for empty item IDs array", async () => {
      const result = await repository.getMenuItemsTaxConfigIds([]);

      expect(prisma.menuItemTax.findMany).not.toHaveBeenCalled();
      expect(result.size).toBe(0);
    });
  });

  describe("setMerchantTaxRate", () => {
    it("should upsert merchant tax rate", async () => {
      const mockResult = {
        id: "mtr-1",
        merchantId: "merchant-1",
        taxConfigId: "tax-1",
        rate: { toNumber: () => 0.09 },
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.merchantTaxRate.upsert).mockResolvedValue(
        mockResult as unknown as ReturnType<
          typeof prisma.merchantTaxRate.upsert
        > extends Promise<infer T>
          ? T
          : never
      );

      await repository.setMerchantTaxRate("merchant-1", "tax-1", 0.09);

      expect(prisma.merchantTaxRate.upsert).toHaveBeenCalledWith({
        where: {
          merchantId_taxConfigId: {
            merchantId: "merchant-1",
            taxConfigId: "tax-1",
          },
        },
        update: {
          rate: 0.09,
          deleted: false,
        },
        create: {
          id: expect.any(String),
          merchantId: "merchant-1",
          taxConfigId: "tax-1",
          rate: 0.09,
        },
      });
    });
  });

  describe("setMenuItemTaxConfigs", () => {
    it("should replace all tax configs for a menu item", async () => {
      vi.mocked(prisma.menuItemTax.updateMany).mockResolvedValue({
        count: 1,
      });
      vi.mocked(prisma.menuItemTax.createMany).mockResolvedValue({
        count: 2,
      });

      await repository.setMenuItemTaxConfigs("tenant-1", "item-1", ["tax-1", "tax-2"]);

      expect(prisma.menuItemTax.updateMany).toHaveBeenCalledWith({
        where: {
          menuItemId: "item-1",
          deleted: false,
        },
        data: {
          deleted: true,
          updatedAt: expect.any(Date),
        },
      });
      expect(prisma.menuItemTax.createMany).toHaveBeenCalledWith({
        data: [
          { id: expect.any(String), tenantId: "tenant-1", menuItemId: "item-1", taxConfigId: "tax-1" },
          { id: expect.any(String), tenantId: "tenant-1", menuItemId: "item-1", taxConfigId: "tax-2" },
        ],
      });
    });

    it("should only soft delete when tax config IDs array is empty", async () => {
      vi.mocked(prisma.menuItemTax.updateMany).mockResolvedValue({
        count: 2,
      });

      await repository.setMenuItemTaxConfigs("tenant-1", "item-1", []);

      expect(prisma.menuItemTax.updateMany).toHaveBeenCalledWith({
        where: {
          menuItemId: "item-1",
          deleted: false,
        },
        data: {
          deleted: true,
          updatedAt: expect.any(Date),
        },
      });
      expect(prisma.menuItemTax.createMany).not.toHaveBeenCalled();
    });
  });

  describe("createTaxConfig", () => {
    it("should create a new tax config", async () => {
      const mockConfig = {
        id: "tax-new",
        tenantId: "tenant-1",
        name: "New Tax",
        description: "A new tax",
        roundingMethod: "half_up",
        inclusionType: "additive",
        status: "active",
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.taxConfig.create).mockResolvedValue(mockConfig);

      const result = await repository.createTaxConfig("tenant-1", {
        name: "New Tax",
        description: "A new tax",
        roundingMethod: "half_up",
      });

      expect(prisma.taxConfig.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          tenantId: "tenant-1",
          name: "New Tax",
          description: "A new tax",
          roundingMethod: "half_up",
          inclusionType: "additive",
        },
      });
      expect(result.name).toBe("New Tax");
    });

    it("should use default values when not provided", async () => {
      const mockConfig = {
        id: "tax-new",
        tenantId: "tenant-1",
        name: "Simple Tax",
        description: null,
        roundingMethod: "half_up",
        inclusionType: "additive",
        status: "active",
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.taxConfig.create).mockResolvedValue(mockConfig);

      await repository.createTaxConfig("tenant-1", {
        name: "Simple Tax",
      });

      expect(prisma.taxConfig.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          tenantId: "tenant-1",
          name: "Simple Tax",
          description: undefined,
          roundingMethod: "half_up",
          inclusionType: "additive",
        },
      });
    });
  });

  describe("updateTaxConfig", () => {
    it("should update a tax config", async () => {
      vi.mocked(prisma.taxConfig.updateMany).mockResolvedValue({ count: 1 });

      await repository.updateTaxConfig("tenant-1", "tax-1", {
        name: "Updated Tax",
        roundingMethod: "always_round_up",
      });

      expect(prisma.taxConfig.updateMany).toHaveBeenCalledWith({
        where: {
          id: "tax-1",
          tenantId: "tenant-1",
        },
        data: {
          name: "Updated Tax",
          roundingMethod: "always_round_up",
        },
      });
    });
  });

  describe("deleteMerchantTaxRate", () => {
    it("should soft delete a merchant tax rate", async () => {
      vi.mocked(prisma.merchantTaxRate.updateMany).mockResolvedValue({
        count: 1,
      });

      await repository.deleteMerchantTaxRate("merchant-1", "tax-1");

      expect(prisma.merchantTaxRate.updateMany).toHaveBeenCalledWith({
        where: {
          merchantId: "merchant-1",
          taxConfigId: "tax-1",
          deleted: false,
        },
        data: {
          deleted: true,
          updatedAt: expect.any(Date),
        },
      });
    });
  });

  describe("getTaxConfigMerchantRates", () => {
    it("should return all merchant rates for a specific tax config", async () => {
      const mockRates = [
        {
          id: "mtr-1",
          merchantId: "merchant-1",
          taxConfigId: "tax-1",
          rate: 0.0825,
          deleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "mtr-2",
          merchantId: "merchant-2",
          taxConfigId: "tax-1",
          rate: 0.09,
          deleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.merchantTaxRate.findMany).mockResolvedValue(
        mockRates as unknown as ReturnType<
          typeof prisma.merchantTaxRate.findMany
        > extends Promise<infer T>
          ? T
          : never
      );

      const result = await repository.getTaxConfigMerchantRates("tax-1");

      expect(prisma.merchantTaxRate.findMany).toHaveBeenCalledWith({
        where: {
          taxConfigId: "tax-1",
          deleted: false,
        },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe("deleteTaxConfig", () => {
    it("should soft delete a tax config by setting status to inactive and deleted to true", async () => {
      vi.mocked(prisma.taxConfig.updateMany).mockResolvedValue({ count: 1 });

      await repository.deleteTaxConfig("tenant-1", "tax-1");

      expect(prisma.taxConfig.updateMany).toHaveBeenCalledWith({
        where: {
          id: "tax-1",
          tenantId: "tenant-1",
        },
        data: {
          status: "inactive",
          deleted: true,
          updatedAt: expect.any(Date),
        },
      });
    });
  });

  describe("inclusionType round-trip", () => {
    it("stores and returns inclusionType from DB row", async () => {
      const createdRow = {
        id: "tax-vat",
        tenantId: "t-1",
        name: "VAT",
        description: null,
        roundingMethod: "half_up",
        inclusionType: "inclusive",
        status: "active",
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.taxConfig.create).mockResolvedValue(createdRow);
      vi.mocked(prisma.taxConfig.findFirst).mockResolvedValue(createdRow);

      const config = await repository.createTaxConfig("t-1", {
        name: "VAT",
        inclusionType: "inclusive",
        roundingMethod: "half_up",
      });

      // Verify inclusionType was passed to Prisma create
      expect(prisma.taxConfig.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          inclusionType: "inclusive",
        }),
      });

      // Verify the returned DTO has inclusionType
      expect(config.inclusionType).toBe("inclusive");

      const loaded = await repository.getTaxConfigById("t-1", config.id);
      expect(loaded?.inclusionType).toBe("inclusive");
    });

    it("defaults inclusionType to 'additive' when field is null/missing in DB row", async () => {
      const rowWithNullInclusion = {
        id: "tax-old",
        tenantId: "t-1",
        name: "Legacy Tax",
        description: null,
        roundingMethod: "half_up",
        inclusionType: null,
        status: "active",
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.taxConfig.findFirst).mockResolvedValue(
        rowWithNullInclusion as unknown as ReturnType<
          typeof prisma.taxConfig.findFirst
        > extends Promise<infer T>
          ? T
          : never
      );

      const loaded = await repository.getTaxConfigById("t-1", "tax-old");
      expect(loaded?.inclusionType).toBe("additive");
    });
  });
});
