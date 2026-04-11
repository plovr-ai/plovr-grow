/**
 * Tax Configuration Service
 * 税率配置服务
 */

import type {
  TaxConfigData,
  TaxConfigInfo,
  TaxConfigWithRates,
  MerchantTaxConfig,
  CreateTaxConfigInput,
  UpdateTaxConfigInput,
  RoundingMethod,
} from "./tax-config.types";

// Lazy load repository to avoid Prisma initialization at module load time
async function getRepository() {
  const { taxConfigRepository } = await import(
    "@/repositories/tax-config.repository"
  );
  return taxConfigRepository;
}

export class TaxConfigService {
  // ==================== Query methods (for Storefront) ====================

  /**
   * Get all tax configs for a company
   */
  async getTaxConfigs(
    tenantId: string
  ): Promise<TaxConfigData[]> {
    const repository = await getRepository();
    const configs = await repository.getTaxConfigsByTenant(tenantId);

    return configs.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      roundingMethod: c.roundingMethod as RoundingMethod,
      inclusionType: c.inclusionType,
      status: c.status as "active" | "inactive",
    }));
  }

  /**
   * Get a single tax config by ID
   */
  async getTaxConfig(
    tenantId: string,
    id: string
  ): Promise<TaxConfigData | null> {
    const repository = await getRepository();
    const config = await repository.getTaxConfigById(tenantId, id);

    if (!config) return null;

    return {
      id: config.id,
      name: config.name,
      description: config.description,
      roundingMethod: config.roundingMethod as RoundingMethod,
      inclusionType: config.inclusionType,
      status: config.status as "active" | "inactive",
    };
  }

  /**
   * Get tax configs as a Map for efficient lookup
   */
  async getTaxConfigsMap(
    tenantId: string,
    ids: string[]
  ): Promise<Map<string, TaxConfigData>> {
    const repository = await getRepository();
    const configs = await repository.getTaxConfigsByIds(tenantId, ids);

    const map = new Map<string, TaxConfigData>();
    for (const c of configs) {
      map.set(c.id, {
        id: c.id,
        name: c.name,
        description: c.description,
        roundingMethod: c.roundingMethod as RoundingMethod,
        inclusionType: c.inclusionType,
        status: c.status as "active" | "inactive",
      });
    }
    return map;
  }

  /**
   * Get merchant tax configs with specific rates
   */
  async getMerchantTaxConfigs(merchantId: string): Promise<MerchantTaxConfig[]> {
    const repository = await getRepository();
    const rates = await repository.getMerchantTaxRates(merchantId);

    return rates.map((r) => ({
      id: r.taxConfigId,
      name: r.taxConfig.name,
      rate: Number(r.rate),
      roundingMethod: r.taxConfig.roundingMethod as RoundingMethod,
      inclusionType: r.taxConfig.inclusionType,
    }));
  }

  // ==================== Dashboard methods ====================

  /**
   * Get all tax configs with their merchant rates (for Dashboard)
   */
  async getTaxConfigsWithRates(
    tenantId: string,
    merchants: Array<{ id: string; name: string }>
  ): Promise<TaxConfigWithRates[]> {
    const repository = await getRepository();
    const taxConfigs = await repository.getTaxConfigsByTenant(tenantId);

    // Get all merchant tax rates in parallel
    const merchantRatesPromises = merchants.map((merchant) =>
      repository.getMerchantTaxRateMap(merchant.id)
    );
    const merchantRateMaps = await Promise.all(merchantRatesPromises);

    return taxConfigs.map((config) => ({
      id: config.id,
      name: config.name,
      description: config.description,
      roundingMethod: config.roundingMethod as RoundingMethod,
      inclusionType: config.inclusionType,
      status: config.status as "active" | "inactive",
      merchantRates: merchants
        .map((merchant, index) => {
          const rateMap = merchantRateMaps[index];
          const rate = rateMap.get(config.id);
          if (rate === undefined) return null;
          return {
            merchantId: merchant.id,
            merchantName: merchant.name,
            rate,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null),
    }));
  }

  /**
   * Get a single tax config info (without rates)
   */
  async getTaxConfigInfo(
    tenantId: string,
    id: string
  ): Promise<TaxConfigInfo | null> {
    const repository = await getRepository();
    const config = await repository.getTaxConfigById(tenantId, id);
    if (!config) return null;

    return {
      id: config.id,
      name: config.name,
      description: config.description,
      roundingMethod: config.roundingMethod as RoundingMethod,
      inclusionType: config.inclusionType,
      status: config.status as "active" | "inactive",
    };
  }

  // ==================== CRUD methods ====================

  /**
   * Create a new tax config
   */
  async createTaxConfig(
    tenantId: string,
    input: CreateTaxConfigInput
  ): Promise<TaxConfigInfo> {
    const repository = await getRepository();

    const config = await repository.createTaxConfig(tenantId, {
      name: input.name,
      description: input.description,
      roundingMethod: input.roundingMethod,
      inclusionType: input.inclusionType ?? "additive",
    });

    // Set merchant rates if provided
    if (input.merchantRates && input.merchantRates.length > 0) {
      await Promise.all(
        input.merchantRates.map((mr) =>
          repository.setMerchantTaxRate(mr.merchantId, config.id, mr.rate)
        )
      );
    }

    return {
      id: config.id,
      name: config.name,
      description: config.description,
      roundingMethod: config.roundingMethod as RoundingMethod,
      inclusionType: config.inclusionType,
      status: config.status as "active" | "inactive",
    };
  }

  /**
   * Update a tax config
   */
  async updateTaxConfig(
    tenantId: string,
    id: string,
    input: UpdateTaxConfigInput
  ): Promise<void> {
    const repository = await getRepository();

    // Update tax config
    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.roundingMethod !== undefined) updateData.roundingMethod = input.roundingMethod;
    if (input.inclusionType !== undefined) updateData.inclusionType = input.inclusionType;
    if (input.status !== undefined) updateData.status = input.status;

    if (Object.keys(updateData).length > 0) {
      await repository.updateTaxConfig(tenantId, id, updateData);
    }

    // Update merchant rates if provided
    if (input.merchantRates !== undefined) {
      // Get current merchant rates
      const currentRates = await repository.getTaxConfigMerchantRates(id);
      const newMerchantIds = new Set(input.merchantRates.map((r) => r.merchantId));

      // Delete rates for merchants not in new list
      for (const rate of currentRates) {
        if (!newMerchantIds.has(rate.merchantId)) {
          await repository.deleteMerchantTaxRate(rate.merchantId, id);
        }
      }

      // Upsert rates for merchants in new list
      for (const mr of input.merchantRates) {
        await repository.setMerchantTaxRate(mr.merchantId, id, mr.rate);
      }
    }
  }

  /**
   * Delete a tax config (soft delete)
   */
  async deleteTaxConfig(tenantId: string, id: string): Promise<void> {
    const repository = await getRepository();
    await repository.deleteTaxConfig(tenantId, id);
  }

  /**
   * Set tax rate for a merchant
   */
  async setMerchantTaxRate(
    merchantId: string,
    taxConfigId: string,
    rate: number
  ): Promise<void> {
    const repository = await getRepository();
    await repository.setMerchantTaxRate(merchantId, taxConfigId, rate);
  }

  /**
   * Set tax configs for a menu item
   */
  async setMenuItemTaxConfigs(
    tenantId: string,
    itemId: string,
    taxConfigIds: string[]
  ): Promise<void> {
    const repository = await getRepository();
    await repository.setMenuItemTaxConfigs(tenantId, itemId, taxConfigIds);
  }
}

export const taxConfigService = new TaxConfigService();
