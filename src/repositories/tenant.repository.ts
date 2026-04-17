import prisma from "@/lib/db";
import type { DbClient } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { generateEntityId } from "@/lib/id";

export class TenantRepository {
  async getById(tenantId: string) {
    return prisma.tenant.findUnique({
      where: { id: tenantId, deleted: false },
    });
  }

  async getBySlug(slug: string) {
    return prisma.tenant.findUnique({
      where: { slug, deleted: false },
    });
  }

  async getBySlugWithMerchants(slug: string) {
    return prisma.tenant.findUnique({
      where: { slug, deleted: false },
      include: {
        merchants: {
          where: { status: "active", deleted: false },
          orderBy: { name: "asc" },
        },
      },
    });
  }

  async getWithMerchants(tenantId: string) {
    return prisma.tenant.findUnique({
      where: { id: tenantId, deleted: false },
      include: {
        merchants: {
          where: { deleted: false },
          orderBy: { name: "asc" },
        },
      },
    });
  }

  /**
   * Minimal lookup used by subscription/billing flows — kept separate to avoid
   * pulling unrelated columns and to stay independent of soft-delete filters
   * applied elsewhere in the repository.
   */
  async getNameAndSupportEmail(tenantId: string) {
    return prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        supportEmail: true,
      },
    });
  }

  async create(
    data: Omit<Prisma.TenantCreateInput, "id"> & { id?: string },
    tx?: DbClient
  ) {
    const db = tx ?? prisma;
    const { id, ...rest } = data;
    return db.tenant.create({
      data: {
        id: id ?? generateEntityId(),
        ...rest,
      },
    });
  }

  async update(
    tenantId: string,
    data: Prisma.TenantUpdateInput,
    tx?: DbClient
  ) {
    const db = tx ?? prisma;
    return db.tenant.update({
      where: { id: tenantId },
      data,
    });
  }

  async delete(tenantId: string) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: { deleted: true, updatedAt: new Date() },
    });
  }
}

export const tenantRepository = new TenantRepository();
