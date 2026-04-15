import prisma from "@/lib/db";
import type { Prisma, TaxConfig } from "@prisma/client";
import { generateEntityId } from "@/lib/id";
import type { TaxInclusionType } from "@/types";

// Normalize a raw DB row so that null inclusionType defaults to "additive"
function normalizeTaxConfig<T extends TaxConfig>(row: T): T & { inclusionType: TaxInclusionType } {
  return {
    ...row,
    inclusionType: (row.inclusionType ?? "additive") as TaxInclusionType,
  };
}

export class TaxConfigRepository {
  // ==================== Query methods ====================

  /**
   * Get all tax configs for a company
   */
  async getTaxConfigsByTenant(tenantId: string) {
    const rows = await prisma.taxConfig.findMany({
      where: {
        tenantId,
        status: "active",
        deleted: false,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
    return rows.map(normalizeTaxConfig);
  }

  /**
   * Get a single tax config by ID
   */
  async getTaxConfigById(tenantId: string, id: string) {
    const row = await prisma.taxConfig.findFirst({
      where: {
        id,
        tenantId,
        deleted: false,
      },
    });
    return row ? normalizeTaxConfig(row) : null;
  }

  /**
   * Get multiple tax configs by IDs
   */
  async getTaxConfigsByIds(tenantId: string, ids: string[]) {
    if (ids.length === 0) return [];
    const rows = await prisma.taxConfig.findMany({
      where: {
        id: { in: ids },
        tenantId,
        status: "active",
        deleted: false,
      },
    });
    return rows.map(normalizeTaxConfig);
  }

  // ==================== Merchant Tax Rates ====================

  /**
   * Get all tax rates for a merchant (with tax config details)
   */
  async getMerchantTaxRates(merchantId: string) {
    const rows = await prisma.merchantTaxRate.findMany({
      where: {
        merchantId,
        deleted: false,
      },
      include: {
        taxConfig: true,
      },
    });
    return rows.map((r) => ({
      ...r,
      taxConfig: normalizeTaxConfig(r.taxConfig),
    }));
  }

  /**
   * Get merchant tax rates as a Map (taxConfigId -> rate)
   */
  async getMerchantTaxRateMap(merchantId: string): Promise<Map<string, number>> {
    const rates = await prisma.merchantTaxRate.findMany({
      where: {
        merchantId,
        deleted: false,
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
        deleted: false,
      },
      create: {
        id: generateEntityId(),
        merchantId,
        taxConfigId,
        rate,
      },
    });
  }

  /**
   * Delete tax rate for a merchant (soft delete)
   */
  async deleteMerchantTaxRate(merchantId: string, taxConfigId: string) {
    return prisma.merchantTaxRate.updateMany({
      where: {
        merchantId,
        taxConfigId,
        deleted: false,
      },
      data: {
        deleted: true,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get all merchant rates for a specific tax config
   */
  async getTaxConfigMerchantRates(taxConfigId: string) {
    return prisma.merchantTaxRate.findMany({
      where: {
        taxConfigId,
        deleted: false,
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
        deleted: false,
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
        deleted: false,
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
   * Soft deletes existing relations, then creates new ones
   */
  async setMenuItemTaxConfigs(tenantId: string, itemId: string, taxConfigIds: string[]) {
    // Soft delete existing relations
    await prisma.menuItemTax.updateMany({
      where: {
        menuItemId: itemId,
        deleted: false,
      },
      data: {
        deleted: true,
        updatedAt: new Date(),
      },
    });

    // Create new relations
    if (taxConfigIds.length > 0) {
      await prisma.menuItemTax.createMany({
        data: taxConfigIds.map((taxConfigId) => ({
          id: generateEntityId(),
          tenantId,
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
    data: {
      name: string;
      description?: string | null;
      roundingMethod?: string;
      inclusionType?: TaxInclusionType;
    }
  ) {
    const row = await prisma.taxConfig.create({
      data: {
        id: generateEntityId(),
        tenantId,
        name: data.name,
        description: data.description,
        roundingMethod: data.roundingMethod ?? "half_up",
        inclusionType: data.inclusionType ?? "additive",
      },
    });
    return normalizeTaxConfig(row);
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
        deleted: true,
        updatedAt: new Date(),
      },
    });
  }
}

export const taxConfigRepository = new TaxConfigRepository();
