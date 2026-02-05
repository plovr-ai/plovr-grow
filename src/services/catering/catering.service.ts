import {
  cateringRepository,
  type CateringRepository,
} from "@/repositories/catering.repository";
import type {
  CateringLeadData,
  CreateCateringLeadInput,
  PaginatedCateringLeads,
  PaginatedCateringLeadsWithMerchant,
} from "./catering.types";
import { toCateringLeadData, toCateringLeadWithMerchant } from "./catering.types";

export class CateringService {
  private _repository: CateringRepository | null = null;

  private get repository(): CateringRepository {
    if (!this._repository) {
      this._repository = cateringRepository;
    }
    return this._repository;
  }

  /**
   * Create a new catering lead
   */
  async createLead(
    tenantId: string,
    merchantId: string,
    input: CreateCateringLeadInput
  ): Promise<CateringLeadData> {
    const lead = await this.repository.create(tenantId, merchantId, {
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      email: input.email,
      notes: input.notes,
    });
    return toCateringLeadData(lead);
  }

  /**
   * Get leads for a specific merchant (paginated)
   */
  async getLeadsByMerchant(
    tenantId: string,
    merchantId: string,
    options?: {
      page?: number;
      pageSize?: number;
      search?: string;
      status?: string;
    }
  ): Promise<PaginatedCateringLeads> {
    const result = await this.repository.getByMerchant(
      tenantId,
      merchantId,
      options
    );
    return {
      ...result,
      items: result.items.map(toCateringLeadData),
    };
  }

  /**
   * Get leads for all merchants in a company (paginated, for dashboard)
   */
  async getLeadsByCompany(
    tenantId: string,
    companyId: string,
    options?: {
      page?: number;
      pageSize?: number;
      search?: string;
      status?: string;
      merchantId?: string;
    }
  ): Promise<PaginatedCateringLeadsWithMerchant> {
    const result = await this.repository.getByCompany(
      tenantId,
      companyId,
      options
    );
    return {
      ...result,
      items: result.items.map(toCateringLeadWithMerchant),
    };
  }

  /**
   * Update lead status
   */
  async updateLeadStatus(
    tenantId: string,
    leadId: string,
    status: string
  ): Promise<void> {
    await this.repository.updateStatus(tenantId, leadId, status);
  }
}

export const cateringService = new CateringService();
