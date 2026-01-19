/**
 * Tax Configuration Service
 * 税率配置服务
 */

import { taxConfigRepository } from "@/repositories/tax-config.repository";
import type {
  TaxConfigData,
  TaxConfigInfo,
  TaxConfigWithRates,
  CreateTaxConfigInput,
  UpdateTaxConfigInput,
  RoundingMethod,
} from "./tax-config.types";

export class TaxConfigService {
  // ==================== Query methods (for Storefront) ====================

  /**
   * Get all active tax configs for a company (with merchant-specific rates)
   * Used by storefront to calculate order tax
   */
  async getTaxConfigsForMerchant(
    tenantId: string,
    companyId: string,
    merchantId: string
  ): Promise<TaxConfigData[]> {
    const [taxConfigs, rateMap] = await Promise.all([
      taxConfigRepository.getTaxConfigsByCompany(tenantId, companyId),
      taxConfigRepository.getMerchantTaxRateMap(merchantId),
    ]);

    return taxConfigs
      .filter((config) => rateMap.has(config.id)) // Only return configs with rates for this merchant
      .map((config) => ({
        id: config.id,
        name: config.name,
        rate: rateMap.get(config.id) ?? 0,
        roundingMethod: config.roundingMethod as RoundingMethod,
        isDefault: config.isDefault,
        status: config.status as "active" | "inactive",
      }));
  }

  /**
   * Get a single tax config by ID (with merchant-specific rate)
   */
  async getTaxConfig(
    tenantId: string,
    id: string,
    merchantId: string
  ): Promise<TaxConfigData | null> {
    const [config, rateMap] = await Promise.all([
      taxConfigRepository.getTaxConfigById(tenantId, id),
      taxConfigRepository.getMerchantTaxRateMap(merchantId),
    ]);

    if (!config) return null;

    return {
      id: config.id,
      name: config.name,
      rate: rateMap.get(config.id) ?? 0,
      roundingMethod: config.roundingMethod as RoundingMethod,
      isDefault: config.isDefault,
      status: config.status as "active" | "inactive",
    };
  }

  /**
   * Get tax configs as a Map for efficient lookup during order calculation
   */
  async getTaxConfigsMap(
    tenantId: string,
    ids: string[],
    merchantId: string
  ): Promise<Map<string, TaxConfigData>> {
    const [configs, rateMap] = await Promise.all([
      taxConfigRepository.getTaxConfigsByIds(tenantId, ids),
      taxConfigRepository.getMerchantTaxRateMap(merchantId),
    ]);

    const map = new Map<string, TaxConfigData>();
    for (const config of configs) {
      map.set(config.id, {
        id: config.id,
        name: config.name,
        rate: rateMap.get(config.id) ?? 0,
        roundingMethod: config.roundingMethod as RoundingMethod,
        isDefault: config.isDefault,
        status: config.status as "active" | "inactive",
      });
    }

    return map;
  }

  /**
   * Get the default tax config for a company
   */
  async getDefaultTaxConfig(
    tenantId: string,
    companyId: string,
    merchantId: string
  ): Promise<TaxConfigData | null> {
    const [config, rateMap] = await Promise.all([
      taxConfigRepository.getDefaultTaxConfig(tenantId, companyId),
      taxConfigRepository.getMerchantTaxRateMap(merchantId),
    ]);

    if (!config) return null;

    return {
      id: config.id,
      name: config.name,
      rate: rateMap.get(config.id) ?? 0,
      roundingMethod: config.roundingMethod as RoundingMethod,
      isDefault: config.isDefault,
      status: config.status as "active" | "inactive",
    };
  }

  // ==================== Dashboard methods ====================

  /**
   * Get all tax configs with their merchant rates (for Dashboard)
   */
  async getTaxConfigsWithRates(
    tenantId: string,
    companyId: string,
    merchants: Array<{ id: string; name: string }>
  ): Promise<TaxConfigWithRates[]> {
    const taxConfigs = await taxConfigRepository.getTaxConfigsByCompany(
      tenantId,
      companyId
    );

    // Get all merchant tax rates in parallel
    const merchantRatesPromises = merchants.map((merchant) =>
      taxConfigRepository.getMerchantTaxRateMap(merchant.id)
    );
    const merchantRateMaps = await Promise.all(merchantRatesPromises);

    return taxConfigs.map((config) => ({
      id: config.id,
      name: config.name,
      description: config.description,
      roundingMethod: config.roundingMethod as RoundingMethod,
      isDefault: config.isDefault,
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
    const config = await taxConfigRepository.getTaxConfigById(tenantId, id);
    if (!config) return null;

    return {
      id: config.id,
      name: config.name,
      description: config.description,
      roundingMethod: config.roundingMethod as RoundingMethod,
      isDefault: config.isDefault,
      status: config.status as "active" | "inactive",
    };
  }

  // ==================== CRUD methods ====================

  /**
   * Create a new tax config with optional merchant rates
   */
  async createTaxConfig(
    tenantId: string,
    companyId: string,
    input: CreateTaxConfigInput
  ): Promise<TaxConfigInfo> {
    // If setting as default, unset existing default
    if (input.isDefault) {
      await this.unsetDefaultTaxConfig(tenantId, companyId);
    }

    const config = await taxConfigRepository.createTaxConfig(
      tenantId,
      companyId,
      {
        name: input.name,
        description: input.description,
        roundingMethod: input.roundingMethod,
        isDefault: input.isDefault,
      }
    );

    // Set merchant rates if provided
    if (input.merchantRates && input.merchantRates.length > 0) {
      await Promise.all(
        input.merchantRates.map((mr) =>
          taxConfigRepository.setMerchantTaxRate(mr.merchantId, config.id, mr.rate)
        )
      );
    }

    return {
      id: config.id,
      name: config.name,
      description: config.description,
      roundingMethod: config.roundingMethod as RoundingMethod,
      isDefault: config.isDefault,
      status: config.status as "active" | "inactive",
    };
  }

  /**
   * Update a tax config with optional merchant rates
   */
  async updateTaxConfig(
    tenantId: string,
    companyId: string,
    id: string,
    input: UpdateTaxConfigInput
  ): Promise<void> {
    // If setting as default, unset existing default
    if (input.isDefault) {
      await this.unsetDefaultTaxConfig(tenantId, companyId, id);
    }

    // Update tax config
    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.roundingMethod !== undefined) updateData.roundingMethod = input.roundingMethod;
    if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;
    if (input.status !== undefined) updateData.status = input.status;

    if (Object.keys(updateData).length > 0) {
      await taxConfigRepository.updateTaxConfig(tenantId, id, updateData);
    }

    // Update merchant rates if provided
    if (input.merchantRates !== undefined) {
      // Get current merchant rates
      const currentRates = await taxConfigRepository.getTaxConfigMerchantRates(id);
      const newMerchantIds = new Set(input.merchantRates.map((r) => r.merchantId));

      // Delete rates for merchants not in new list
      for (const rate of currentRates) {
        if (!newMerchantIds.has(rate.merchantId)) {
          await taxConfigRepository.deleteMerchantTaxRate(rate.merchantId, id);
        }
      }

      // Upsert rates for merchants in new list
      for (const mr of input.merchantRates) {
        await taxConfigRepository.setMerchantTaxRate(mr.merchantId, id, mr.rate);
      }
    }
  }

  /**
   * Delete a tax config (soft delete)
   */
  async deleteTaxConfig(tenantId: string, id: string): Promise<void> {
    await taxConfigRepository.deleteTaxConfig(tenantId, id);
  }

  // ==================== Helper methods ====================

  /**
   * Unset the default tax config for a company
   */
  private async unsetDefaultTaxConfig(
    tenantId: string,
    companyId: string,
    excludeId?: string
  ): Promise<void> {
    const currentDefault = await taxConfigRepository.getDefaultTaxConfig(
      tenantId,
      companyId
    );
    if (currentDefault && currentDefault.id !== excludeId) {
      await taxConfigRepository.updateTaxConfig(tenantId, currentDefault.id, {
        isDefault: false,
      });
    }
  }
}

export const taxConfigService = new TaxConfigService();
