/**
 * Tax Configuration Service
 * 税率配置服务（Mock-based）
 */

import {
  getMockTaxConfigs,
  getMockTaxConfigById,
} from "@/data/mock/tax-config";
import type { TaxConfigData } from "./tax-config.types";

export class TaxConfigService {
  /**
   * Get all active tax configs for a tenant
   */
  async getTaxConfigs(tenantId: string): Promise<TaxConfigData[]> {
    // TODO: Replace with repository call when database is ready
    return getMockTaxConfigs();
  }

  /**
   * Get a single tax config by ID
   */
  async getTaxConfig(
    tenantId: string,
    id: string
  ): Promise<TaxConfigData | null> {
    // TODO: Replace with repository call when database is ready
    return getMockTaxConfigById(id) ?? null;
  }

  /**
   * Get tax configs as a Map for efficient lookup during order calculation
   */
  async getTaxConfigsMap(
    tenantId: string,
    ids: string[]
  ): Promise<Map<string, TaxConfigData>> {
    const map = new Map<string, TaxConfigData>();
    const uniqueIds = [...new Set(ids.filter(Boolean))];

    for (const id of uniqueIds) {
      const config = getMockTaxConfigById(id);
      if (config) {
        map.set(id, config);
      }
    }

    return map;
  }

  /**
   * Get the default tax config for a tenant
   */
  async getDefaultTaxConfig(tenantId: string): Promise<TaxConfigData | null> {
    const configs = getMockTaxConfigs();
    return configs.find((c) => c.isDefault) ?? null;
  }
}

export const taxConfigService = new TaxConfigService();
