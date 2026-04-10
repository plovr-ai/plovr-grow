import prisma from "@/lib/db";
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

  async create(data: Omit<Prisma.TenantCreateInput, "id">) {
    return prisma.tenant.create({
      data: {
        id: generateEntityId(),
        ...data,
      },
    });
  }

  async update(tenantId: string, data: Prisma.TenantUpdateInput) {
    return prisma.tenant.update({
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
