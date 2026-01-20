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
    tenantId: string,
    companyId: string
  ): Promise<LoyaltyConfigData | null> {
    const config = await this.repository.getByCompanyId(tenantId, companyId);
    if (!config) return null;
    return toLoyaltyConfigData(config);
  }

  /**
   * Check if loyalty is enabled for a company
   */
  async isLoyaltyEnabled(tenantId: string, companyId: string): Promise<boolean> {
    const config = await this.repository.getByCompanyId(tenantId, companyId);
    return config?.status === "active";
  }

  /**
   * Get points per dollar configuration
   */
  async getPointsPerDollar(tenantId: string, companyId: string): Promise<number> {
    const config = await this.repository.getByCompanyId(tenantId, companyId);
    if (!config) return 1; // Default to 1 point per dollar
    return Number(config.pointsPerDollar);
  }

  /**
   * Create or update loyalty config
   */
  async upsertLoyaltyConfig(
    tenantId: string,
    companyId: string,
    input: UpsertLoyaltyConfigInput
  ): Promise<LoyaltyConfigData> {
    const config = await this.repository.upsert(tenantId, companyId, {
      pointsPerDollar: input.pointsPerDollar,
      status: input.status,
    });
    return toLoyaltyConfigData(config);
  }

  /**
   * Enable loyalty program
   */
  async enableLoyalty(tenantId: string, companyId: string): Promise<void> {
    const existing = await this.repository.getByCompanyId(tenantId, companyId);
    if (existing) {
      await this.repository.setStatus(tenantId, companyId, "active");
    } else {
      await this.repository.create(tenantId, companyId, { status: "active" });
    }
  }

  /**
   * Disable loyalty program
   */
  async disableLoyalty(tenantId: string, companyId: string): Promise<void> {
    await this.repository.setStatus(tenantId, companyId, "inactive");
  }

  /**
   * Set loyalty status (enable/disable)
   */
  async setLoyaltyStatus(
    tenantId: string,
    companyId: string,
    status: "active" | "inactive"
  ): Promise<void> {
    const existing = await this.repository.getByCompanyId(tenantId, companyId);
    if (existing) {
      await this.repository.setStatus(tenantId, companyId, status);
    } else if (status === "active") {
      await this.repository.create(tenantId, companyId, { status: "active" });
    }
  }
}

export const loyaltyConfigService = new LoyaltyConfigService();
