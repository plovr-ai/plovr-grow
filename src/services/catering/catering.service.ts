import { cateringRepository } from "@/repositories/catering.repository";
import type {
  CateringLeadData,
  CateringLeadWithMerchant,
  CreateCateringLeadInput,
  PaginatedCateringLeads,
  PaginatedCateringLeadsWithMerchant,
} from "./catering.types";
import { toCateringLeadData, toCateringLeadWithMerchant } from "./catering.types";

/**
 * Create a new catering lead
 */
async function createLead(
  tenantId: string,
  merchantId: string,
  input: CreateCateringLeadInput
): Promise<CateringLeadData> {
  const lead = await cateringRepository.create(tenantId, merchantId, {
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
async function getLeadsByMerchant(
  tenantId: string,
  merchantId: string,
  options?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
  }
): Promise<PaginatedCateringLeads> {
  const result = await cateringRepository.getByMerchant(
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
async function getLeadsByCompany(
  tenantId: string,
  options?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    merchantId?: string;
  }
): Promise<PaginatedCateringLeadsWithMerchant> {
  const result = await cateringRepository.getByTenant(tenantId, options);
  return {
    ...result,
    items: result.items.map(toCateringLeadWithMerchant),
  };
}

/**
 * Update lead status
 */
async function updateLeadStatus(
  tenantId: string,
  leadId: string,
  status: string
): Promise<void> {
  await cateringRepository.updateStatus(tenantId, leadId, status);
}

/**
 * Get a single lead by ID
 */
async function getLeadById(
  tenantId: string,
  leadId: string
): Promise<CateringLeadWithMerchant | null> {
  const lead = await cateringRepository.getById(tenantId, leadId);
  if (!lead) return null;
  return toCateringLeadWithMerchant(lead);
}

export const cateringService = {
  createLead,
  getLeadsByMerchant,
  getLeadsByCompany,
  updateLeadStatus,
  getLeadById,
};
