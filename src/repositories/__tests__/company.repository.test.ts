import { describe, it, expect, vi, beforeEach } from "vitest";
import { CompanyRepository } from "../company.repository";

vi.mock("@/lib/db", () => ({
  default: {
    company: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/id", () => ({
  generateEntityId: vi.fn(() => "company-id-123"),
}));

import prisma from "@/lib/db";

describe("CompanyRepository", () => {
  let repo: CompanyRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new CompanyRepository();
  });

  describe("getById", () => {
    it("should find company by ID", async () => {
      const mockCompany = { id: "c1", name: "Test Co" };
      vi.mocked(prisma.company.findUnique).mockResolvedValue(mockCompany as never);

      const result = await repo.getById("c1");

      expect(prisma.company.findUnique).toHaveBeenCalledWith({
        where: { id: "c1", deleted: false },
      });
      expect(result).toEqual(mockCompany);
    });
  });

  describe("getByTenantId", () => {
    it("should find company by tenant ID", async () => {
      const mockCompany = { id: "c1", tenantId: "t1" };
      vi.mocked(prisma.company.findUnique).mockResolvedValue(mockCompany as never);

      const result = await repo.getByTenantId("t1");

      expect(prisma.company.findUnique).toHaveBeenCalledWith({
        where: { tenantId: "t1", deleted: false },
      });
      expect(result).toEqual(mockCompany);
    });
  });

  describe("getBySlug", () => {
    it("should find company by slug", async () => {
      const mockCompany = { id: "c1", slug: "joes-pizza" };
      vi.mocked(prisma.company.findUnique).mockResolvedValue(mockCompany as never);

      const result = await repo.getBySlug("joes-pizza");

      expect(prisma.company.findUnique).toHaveBeenCalledWith({
        where: { slug: "joes-pizza", deleted: false },
      });
      expect(result).toEqual(mockCompany);
    });
  });

  describe("getBySlugWithMerchants", () => {
    it("should find company with merchants", async () => {
      const mockCompany = {
        id: "c1",
        slug: "joes-pizza",
        merchants: [{ id: "m1", name: "Downtown" }],
      };
      vi.mocked(prisma.company.findUnique).mockResolvedValue(mockCompany as never);

      const result = await repo.getBySlugWithMerchants("joes-pizza");

      expect(prisma.company.findUnique).toHaveBeenCalledWith({
        where: { slug: "joes-pizza", deleted: false },
        include: {
          tenant: true,
          merchants: {
            where: { status: "active", deleted: false },
            orderBy: { name: "asc" },
          },
        },
      });
      expect(result).toEqual(mockCompany);
    });
  });

  describe("getWithMerchants", () => {
    it("should find company with all merchants", async () => {
      vi.mocked(prisma.company.findUnique).mockResolvedValue({ id: "c1" } as never);

      await repo.getWithMerchants("c1");

      expect(prisma.company.findUnique).toHaveBeenCalledWith({
        where: { id: "c1", deleted: false },
        include: {
          merchants: {
            where: { deleted: false },
            orderBy: { name: "asc" },
          },
        },
      });
    });
  });

  describe("getWithTenant", () => {
    it("should find company with tenant", async () => {
      vi.mocked(prisma.company.findUnique).mockResolvedValue({ id: "c1" } as never);

      await repo.getWithTenant("c1");

      expect(prisma.company.findUnique).toHaveBeenCalledWith({
        where: { id: "c1", deleted: false },
        include: { tenant: true },
      });
    });
  });

  describe("create", () => {
    it("should create a company connected to tenant", async () => {
      vi.mocked(prisma.company.create).mockResolvedValue({ id: "company-id-123" } as never);

      await repo.create("t1", {
        slug: "joes-pizza",
        name: "Joe's Pizza",
      } as never);

      expect(prisma.company.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: "company-id-123",
          slug: "joes-pizza",
          name: "Joe's Pizza",
          tenant: { connect: { id: "t1" } },
        }),
      });
    });
  });

  describe("update", () => {
    it("should update company by ID", async () => {
      vi.mocked(prisma.company.update).mockResolvedValue({} as never);

      await repo.update("c1", { name: "New Name" });

      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: "c1" },
        data: { name: "New Name" },
      });
    });
  });

  describe("delete", () => {
    it("should soft delete company", async () => {
      vi.mocked(prisma.company.update).mockResolvedValue({} as never);

      await repo.delete("c1");

      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: "c1" },
        data: { deleted: true, updatedAt: expect.any(Date) },
      });
    });
  });

  describe("getBySlugWithFullMerchants", () => {
    it("should find company with full merchant data", async () => {
      vi.mocked(prisma.company.findUnique).mockResolvedValue({ id: "c1" } as never);

      await repo.getBySlugWithFullMerchants("joes-pizza");

      expect(prisma.company.findUnique).toHaveBeenCalledWith({
        where: { slug: "joes-pizza", deleted: false },
        include: {
          tenant: true,
          merchants: {
            where: { status: "active", deleted: false },
            orderBy: { name: "asc" },
          },
        },
      });
    });
  });
});
