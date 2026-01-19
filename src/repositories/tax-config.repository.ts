import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";

export class TaxConfigRepository {
  // ==================== Query methods ====================

  /**
   * Get all tax configs for a company
   */
  async getTaxConfigsByCompany(tenantId: string, companyId: string) {
    return prisma.taxConfig.findMany({
      where: {
        tenantId,
        companyId,
        status: "active",
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  /**
   * Get a single tax config by ID
   */
  async getTaxConfigById(tenantId: string, id: string) {
    return prisma.taxConfig.findFirst({
      where: {
        id,
        tenantId,
      },
    });
  }

  /**
   * Get multiple tax configs by IDs
   */
  async getTaxConfigsByIds(tenantId: string, ids: string[]) {
    if (ids.length === 0) return [];
    return prisma.taxConfig.findMany({
      where: {
        id: { in: ids },
        tenantId,
        status: "active",
      },
    });
  }

  /**
   * Get default tax config for a company
   */
  async getDefaultTaxConfig(tenantId: string, companyId: string) {
    return prisma.taxConfig.findFirst({
      where: {
        tenantId,
        companyId,
        isDefault: true,
        status: "active",
      },
    });
  }

  // ==================== Merchant Tax Rates ====================

  /**
   * Get all tax rates for a merchant (with tax config details)
   */
  async getMerchantTaxRates(merchantId: string) {
    return prisma.merchantTaxRate.findMany({
      where: {
        merchantId,
      },
      include: {
        taxConfig: true,
      },
    });
  }

  /**
   * Get merchant tax rates as a Map (taxConfigId -> rate)
   */
  async getMerchantTaxRateMap(merchantId: string): Promise<Map<string, number>> {
    const rates = await prisma.merchantTaxRate.findMany({
      where: {
        merchantId,
      },
      select: {
        taxConfigId: true,
        rate: true,
      },
    });

    const map = new Map<string, number>();
    for (const r of rates) {
      map.set(r.taxConfigId, Number(r.rate));
    }
    return map;
  }

  /**
   * Set tax rate for a merchant (upsert)
   */
  async setMerchantTaxRate(merchantId: string, taxConfigId: string, rate: number) {
    return prisma.merchantTaxRate.upsert({
      where: {
        merchantId_taxConfigId: {
          merchantId,
          taxConfigId,
        },
      },
      update: {
        rate,
      },
      create: {
        id: crypto.randomUUID(),
        merchantId,
        taxConfigId,
        rate,
      },
    });
  }

  // ==================== Menu Item Taxes ====================

  /**
   * Get tax config IDs for a menu item
   */
  async getMenuItemTaxConfigIds(itemId: string): Promise<string[]> {
    const relations = await prisma.menuItemTax.findMany({
      where: {
        menuItemId: itemId,
      },
      select: {
        taxConfigId: true,
      },
    });
    return relations.map((r) => r.taxConfigId);
  }

  /**
   * Get tax config IDs for multiple menu items
   * Returns a Map (itemId -> taxConfigIds[])
   */
  async getMenuItemsTaxConfigIds(itemIds: string[]): Promise<Map<string, string[]>> {
    if (itemIds.length === 0) return new Map();

    const relations = await prisma.menuItemTax.findMany({
      where: {
        menuItemId: { in: itemIds },
      },
      select: {
        menuItemId: true,
        taxConfigId: true,
      },
    });

    const map = new Map<string, string[]>();
    for (const itemId of itemIds) {
      map.set(itemId, []);
    }
    for (const r of relations) {
      const taxIds = map.get(r.menuItemId);
      if (taxIds) {
        taxIds.push(r.taxConfigId);
      }
    }
    return map;
  }

  /**
   * Set tax configs for a menu item (replace all)
   */
  async setMenuItemTaxConfigs(itemId: string, taxConfigIds: string[]) {
    // Delete existing relations
    await prisma.menuItemTax.deleteMany({
      where: {
        menuItemId: itemId,
      },
    });

    // Create new relations
    if (taxConfigIds.length > 0) {
      await prisma.menuItemTax.createMany({
        data: taxConfigIds.map((taxConfigId) => ({
          id: crypto.randomUUID(),
          menuItemId: itemId,
          taxConfigId,
        })),
      });
    }
  }

  // ==================== CRUD methods ====================

  /**
   * Create a new tax config
   */
  async createTaxConfig(
    tenantId: string,
    companyId: string,
    data: {
      name: string;
      description?: string | null;
      roundingMethod?: string;
      isDefault?: boolean;
    }
  ) {
    return prisma.taxConfig.create({
      data: {
        id: crypto.randomUUID(),
        tenantId,
        companyId,
        name: data.name,
        description: data.description,
        roundingMethod: data.roundingMethod ?? "half_up",
        isDefault: data.isDefault ?? false,
      },
    });
  }

  /**
   * Update a tax config
   */
  async updateTaxConfig(
    tenantId: string,
    id: string,
    data: Prisma.TaxConfigUpdateInput
  ) {
    return prisma.taxConfig.updateMany({
      where: {
        id,
        tenantId,
      },
      data,
    });
  }

  /**
   * Delete a tax config (soft delete)
   */
  async deleteTaxConfig(tenantId: string, id: string) {
    return prisma.taxConfig.updateMany({
      where: {
        id,
        tenantId,
      },
      data: {
        status: "inactive",
      },
    });
  }
}

export const taxConfigRepository = new TaxConfigRepository();
