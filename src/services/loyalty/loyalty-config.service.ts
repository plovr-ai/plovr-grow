import {
  loyaltyConfigRepository,
  type LoyaltyConfigRepository,
} from "@/repositories/loyalty-config.repository";
import type {
  LoyaltyConfigData,
  UpsertLoyaltyConfigInput,
} from "./loyalty.types";
import { toLoyaltyConfigData } from "./loyalty.types";

export class LoyaltyConfigService {
  private _repository: LoyaltyConfigRepository | null = null;

  private get repository(): LoyaltyConfigRepository {
    if (!this._repository) {
      this._repository = loyaltyConfigRepository;
    }
    return this._repository;
  }

  /**
   * Get loyalty config for a company
   */
  async getLoyaltyConfig(
    tenantId: string
  ): Promise<LoyaltyConfigData | null> {
    const config = await this.repository.getByTenantId(tenantId);
    if (!config) return null;
    return toLoyaltyConfigData(config);
  }

  /**
   * Check if loyalty is enabled for a company
   */
  async isLoyaltyEnabled(tenantId: string): Promise<boolean> {
    const config = await this.repository.getByTenantId(tenantId);
    return config?.status === "active";
  }

  /**
   * Get points per dollar configuration
   */
  async getPointsPerDollar(tenantId: string): Promise<number> {
    const config = await this.repository.getByTenantId(tenantId);
    if (!config) return 1; // Default to 1 point per dollar
    return Number(config.pointsPerDollar);
  }

  /**
   * Create or update loyalty config
   */
  async upsertLoyaltyConfig(
    tenantId: string,
    input: UpsertLoyaltyConfigInput
  ): Promise<LoyaltyConfigData> {
    const config = await this.repository.upsert(tenantId, {
      pointsPerDollar: input.pointsPerDollar,
      status: input.status,
    });
    return toLoyaltyConfigData(config);
  }

  /**
   * Enable loyalty program
   */
  async enableLoyalty(tenantId: string): Promise<void> {
    const existing = await this.repository.getByTenantId(tenantId);
    if (existing) {
      await this.repository.setStatus(tenantId, "active");
    } else {
      await this.repository.create(tenantId, { status: "active" });
    }
  }

  /**
   * Disable loyalty program
   */
  async disableLoyalty(tenantId: string): Promise<void> {
    await this.repository.setStatus(tenantId, "inactive");
  }

  /**
   * Set loyalty status (enable/disable)
   */
  async setLoyaltyStatus(
    tenantId: string,
    status: "active" | "inactive"
  ): Promise<void> {
    const existing = await this.repository.getByTenantId(tenantId);
    if (existing) {
      await this.repository.setStatus(tenantId, status);
    } else if (status === "active") {
      await this.repository.create(tenantId, { status: "active" });
    }
  }
}

export const loyaltyConfigService = new LoyaltyConfigService();
