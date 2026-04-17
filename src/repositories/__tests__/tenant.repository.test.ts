import { describe, it, expect, vi, beforeEach } from "vitest";
import { TenantRepository } from "../tenant.repository";

// Mock Prisma client
vi.mock("@/lib/db", () => ({
  default: {
    tenant: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock generateEntityId
vi.mock("@/lib/id", () => ({
  generateEntityId: vi.fn(() => "generated-id-123"),
}));

import prisma from "@/lib/db";

describe("TenantRepository", () => {
  let repository: TenantRepository;

  const mockTenant = {
    id: "tenant-1",
    slug: "joes-pizza",
    name: "Joe's Pizza",
    logoUrl: "https://example.com/logo.png",
    settings: {},
    deleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMerchant = {
    id: "merchant-1",
    tenantId: "tenant-1",
    slug: "joes-pizza-downtown",
    name: "Joe's Pizza - Downtown",
    status: "active",
    deleted: false,
  };

  const mockTenantWithMerchants = {
    ...mockTenant,
    merchants: [mockMerchant],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new TenantRepository();
  });

  describe("getById", () => {
    it("should find tenant by ID with deleted=false filter", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(mockTenant as never);

      const result = await repository.getById("tenant-1");

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: "tenant-1", deleted: false },
      });
      expect(result).toEqual(mockTenant);
    });

    it("should return null when tenant not found", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null);

      const result = await repository.getById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("getBySlug", () => {
    it("should find tenant by slug with deleted=false filter", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(mockTenant as never);

      const result = await repository.getBySlug("joes-pizza");

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { slug: "joes-pizza", deleted: false },
      });
      expect(result).toEqual(mockTenant);
    });

    it("should return null for non-existent slug", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null);

      const result = await repository.getBySlug("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("getBySlugWithMerchants", () => {
    it("should find tenant by slug with active merchants included", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(mockTenantWithMerchants as never);

      const result = await repository.getBySlugWithMerchants("joes-pizza");

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { slug: "joes-pizza", deleted: false },
        include: {
          merchants: {
            where: { status: "active", deleted: false },
            orderBy: { name: "asc" },
          },
        },
      });
      expect(result).toEqual(mockTenantWithMerchants);
    });

    it("should return null for non-existent slug", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null);

      const result = await repository.getBySlugWithMerchants("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("getWithMerchants", () => {
    it("should find tenant by ID with all merchants included", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(mockTenantWithMerchants as never);

      const result = await repository.getWithMerchants("tenant-1");

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: "tenant-1", deleted: false },
        include: {
          merchants: {
            where: { deleted: false },
            orderBy: { name: "asc" },
          },
        },
      });
      expect(result).toEqual(mockTenantWithMerchants);
    });

    it("should return null when tenant not found", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null);

      const result = await repository.getWithMerchants("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("getNameAndSupportEmail", () => {
    it("should select only name and supportEmail without deleted filter", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue({
        name: "Joe's Pizza",
        supportEmail: "support@joes.com",
      } as never);

      const result = await repository.getNameAndSupportEmail("tenant-1");

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: "tenant-1" },
        select: { name: true, supportEmail: true },
      });
      expect(result).toEqual({ name: "Joe's Pizza", supportEmail: "support@joes.com" });
    });

    it("should return null when tenant not found", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null);
      const result = await repository.getNameAndSupportEmail("missing");
      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("should create tenant with generated ID when no id supplied", async () => {
      vi.mocked(prisma.tenant.create).mockResolvedValue(mockTenant as never);

      const createData = {
        slug: "new-restaurant",
        name: "New Restaurant",
      };

      const result = await repository.create(createData);

      expect(prisma.tenant.create).toHaveBeenCalledWith({
        data: {
          id: "generated-id-123",
          ...createData,
        },
      });
      expect(result).toEqual(mockTenant);
    });

    it("should use caller-supplied id when present", async () => {
      vi.mocked(prisma.tenant.create).mockResolvedValue(mockTenant as never);

      await repository.create({ id: "pre-allocated-id", slug: "x", name: "X" });

      expect(prisma.tenant.create).toHaveBeenCalledWith({
        data: { id: "pre-allocated-id", slug: "x", name: "X" },
      });
    });

    it("should use tx client when provided", async () => {
      const txCreate = vi.fn().mockResolvedValue(mockTenant);
      const tx = { tenant: { create: txCreate } } as never;

      await repository.create({ slug: "y", name: "Y" }, tx);

      expect(txCreate).toHaveBeenCalledWith({
        data: { id: "generated-id-123", slug: "y", name: "Y" },
      });
      expect(prisma.tenant.create).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should update tenant by ID", async () => {
      vi.mocked(prisma.tenant.update).mockResolvedValue({
        ...mockTenant,
        name: "Updated Name",
      } as never);

      const result = await repository.update("tenant-1", { name: "Updated Name" });

      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: "tenant-1" },
        data: { name: "Updated Name" },
      });
      expect(result.name).toBe("Updated Name");
    });

    it("should use tx client when provided", async () => {
      const txUpdate = vi.fn().mockResolvedValue({ ...mockTenant, name: "Tx Update" });
      const tx = { tenant: { update: txUpdate } } as never;

      await repository.update("tenant-1", { name: "Tx Update" }, tx);

      expect(txUpdate).toHaveBeenCalledWith({
        where: { id: "tenant-1" },
        data: { name: "Tx Update" },
      });
      expect(prisma.tenant.update).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("should soft delete tenant by setting deleted=true", async () => {
      vi.mocked(prisma.tenant.update).mockResolvedValue({
        ...mockTenant,
        deleted: true,
      } as never);

      const result = await repository.delete("tenant-1");

      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: "tenant-1" },
        data: { deleted: true, updatedAt: expect.any(Date) },
      });
      expect(result.deleted).toBe(true);
    });
  });
});
