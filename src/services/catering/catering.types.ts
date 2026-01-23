import type { CateringLead } from "@prisma/client";

export interface CateringLeadData {
  id: string;
  tenantId: string;
  merchantId: string;
  name: string;
  phone: string;
  email: string;
  notes: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CateringLeadWithMerchant extends CateringLeadData {
  merchant: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface CreateCateringLeadInput {
  name: string;
  phone: string;
  email: string;
  notes?: string;
}

export interface PaginatedCateringLeads {
  items: CateringLeadData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginatedCateringLeadsWithMerchant {
  items: CateringLeadWithMerchant[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const CATERING_STATUSES = {
  PENDING: "pending",
  CONTACTED: "contacted",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type CateringStatus =
  (typeof CATERING_STATUSES)[keyof typeof CATERING_STATUSES];

export function toCateringLeadData(lead: CateringLead): CateringLeadData {
  return {
    id: lead.id,
    tenantId: lead.tenantId,
    merchantId: lead.merchantId,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    notes: lead.notes,
    status: lead.status,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  };
}

export function toCateringLeadWithMerchant(
  lead: CateringLead & {
    merchant: {
      id: string;
      name: string;
      slug: string;
    };
  }
): CateringLeadWithMerchant {
  return {
    ...toCateringLeadData(lead),
    merchant: lead.merchant,
  };
}
