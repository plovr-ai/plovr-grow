import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Lead is a pre-tenant marketing entity captured from landing pages and
 * calculators. It has no tenantId because it represents a prospect, not a
 * customer.
 */
export class LeadRepository {
  async create(data: Prisma.LeadCreateInput) {
    return prisma.lead.create({ data });
  }
}

export const leadRepository = new LeadRepository();
