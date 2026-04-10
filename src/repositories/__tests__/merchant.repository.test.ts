import { describe, it, expect, vi, beforeEach } from "vitest";
import { MerchantRepository } from "../merchant.repository";

// Mock Prisma client
vi.mock("@/lib/db", () => ({
  default: {
    merchant: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock generateEntityId
vi.mock("@/lib/id", () => ({
  generateEntityId: vi.fn(() => "generated-id-123"),
}));

import prisma from "@/lib/db";

describe("MerchantRepository", () => {
  let repository: MerchantRepository;

  const mockMerchant = {
    id: "merchant-1",
    companyId: "company-1",
    tenantId: "tenant-1",
    slug: "joes-pizza-downtown",
    name: "Joe's Pizza - Downtown",
    description: "Downtown location",
    address: "123 Main St",
    city: "New York",
    state: "NY",
    zipCode: "10001",
    country: "US",
    phone: "(212) 555-0100",
    email: "downtown@joespizza.com",
    logoUrl: null,
    bannerUrl: null,
    businessHours: {
      mon: { open: "09:00", close: "22:00" },
      tue: { open: "09:00", close: "22:00" },
      wed: { open: "09:00", close: "22:00" },
      thu: { open: "09:00", close: "22:00" },
      fri: { open: "09:00", close: "23:00" },
      sat: { open: "10:00", close: "23:00" },
      sun: { open: "10:00", close: "21:00", closed: false },
    },
    timezone: "America/New_York",
    currency: "USD",
    locale: "en-US",
    status: "active",
    settings: {},
    deleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCompanyTenant = {
    id: "company-1",
    slug: "joes-pizza",
    tenantId: "tenant-1",
    name: "Joe's Pizza",
    logoUrl: "https://example.com/logo.png",
    settings: {},
    tenant: {
      id: "tenant-1",
      name: "Joe's Pizza Tenant",
      subscriptionStatus: "active",
    },
  };

  const mockMerchantWithCompany = {
    ...mockMerchant,
    company: mockCompanyTenant,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new MerchantRepository();
  });

  describe("getById", () => {
    it("should find merchant by ID with deleted=false filter", async () => {
      vi.mocked(prisma.merchant.findUnique).mockResolvedValue(mockMerchant as never);

      const result = await repository.getById("merchant-1");

      expect(prisma.merchant.findUnique).toHaveBeenCalledWith({
        where: { id: "merchant-1", deleted: false },
      });
      expect(result).toEqual(mockMerchant);
    });

    it("should return null when merchant not found", async () => {
      vi.mocked(prisma.merchant.findUnique).mockResolvedValue(null);

      const result = await repository.getById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("getByTenantId", () => {
    it("should return first merchant for tenant via company", async () => {
      vi.mocked(prisma.company.findUnique).mockResolvedValue({
        ...mockCompanyTenant,
        merchants: [mockMerchant],
      } as never);

      const result = await repository.getByTenantId("tenant-1");

      expect(prisma.company.findUnique).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1", deleted: false },
        include: {
          merchants: {
            where: { deleted: false },
            take: 1,
          },
        },
      });
      expect(result).toEqual(mockMerchant);
    });

    it("should return null when company not found", async () => {
      vi.mocked(prisma.company.findUnique).mockResolvedValue(null);

      const result = await repository.getByTenantId("non-existent");

      expect(result).toBeNull();
    });

    it("should return null when company has no merchants", async () => {
      vi.mocked(prisma.company.findUnique).mockResolvedValue({
        ...mockCompanyTenant,
        merchants: [],
      } as never);

      const result = await repository.getByTenantId("tenant-1");

      expect(result).toBeNull();
    });
  });

  describe("getBySlug", () => {
    it("should find merchant by slug", async () => {
      vi.mocked(prisma.merchant.findFirst).mockResolvedValue(mockMerchant as never);

      const result = await repository.getBySlug("joes-pizza-downtown");

      expect(prisma.merchant.findFirst).toHaveBeenCalledWith({
        where: { slug: "joes-pizza-downtown", deleted: false },
      });
      expect(result).toEqual(mockMerchant);
    });

    it("should return null for non-existent slug", async () => {
      vi.mocked(prisma.merchant.findFirst).mockResolvedValue(null);

      const result = await repository.getBySlug("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("getBySlugWithCompany", () => {
    it("should find merchant by slug with company and tenant included", async () => {
      vi.mocked(prisma.merchant.findFirst).mockResolvedValue(mockMerchantWithCompany as never);

      const result = await repository.getBySlugWithCompany("joes-pizza-downtown");

      expect(prisma.merchant.findFirst).toHaveBeenCalledWith({
        where: { slug: "joes-pizza-downtown", deleted: false },
        include: {
          company: {
            include: {
              tenant: true,
            },
          },
        },
      });
      expect(result).toEqual(mockMerchantWithCompany);
    });

    it("should return null for non-existent slug", async () => {
      vi.mocked(prisma.merchant.findFirst).mockResolvedValue(null);

      const result = await repository.getBySlugWithCompany("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("getByCompanyId", () => {
    it("should return merchants ordered by name", async () => {
      vi.mocked(prisma.merchant.findMany).mockResolvedValue([mockMerchant] as never);

      const result = await repository.getByCompanyId("company-1");

      expect(prisma.merchant.findMany).toHaveBeenCalledWith({
        where: { companyId: "company-1", deleted: false },
        orderBy: { name: "asc" },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe("getActiveByCompanyId", () => {
    it("should return only active merchants", async () => {
      vi.mocked(prisma.merchant.findMany).mockResolvedValue([mockMerchant] as never);

      const result = await repository.getActiveByCompanyId("company-1");

      expect(prisma.merchant.findMany).toHaveBeenCalledWith({
        where: {
          companyId: "company-1",
          status: "active",
          deleted: false,
        },
        orderBy: { name: "asc" },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe("getByIdWithCompany", () => {
    it("should find merchant by ID with company and tenant", async () => {
      vi.mocked(prisma.merchant.findUnique).mockResolvedValue(mockMerchantWithCompany as never);

      const result = await repository.getByIdWithCompany("merchant-1");

      expect(prisma.merchant.findUnique).toHaveBeenCalledWith({
        where: { id: "merchant-1", deleted: false },
        include: {
          company: {
            include: {
              tenant: true,
            },
          },
        },
      });
      expect(result).toEqual(mockMerchantWithCompany);
    });
  });

  describe("getByCompanyIdWithCompany", () => {
    it("should return merchants with company info", async () => {
      vi.mocked(prisma.merchant.findMany).mockResolvedValue([mockMerchantWithCompany] as never);

      const result = await repository.getByCompanyIdWithCompany("company-1");

      expect(prisma.merchant.findMany).toHaveBeenCalledWith({
        where: { companyId: "company-1", deleted: false },
        orderBy: { name: "asc" },
        include: {
          company: {
            include: {
              tenant: true,
            },
          },
        },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe("getActiveByCompanyIdWithCompany", () => {
    it("should return active merchants with company info", async () => {
      vi.mocked(prisma.merchant.findMany).mockResolvedValue([mockMerchantWithCompany] as never);

      const result = await repository.getActiveByCompanyIdWithCompany("company-1");

      expect(prisma.merchant.findMany).toHaveBeenCalledWith({
        where: {
          companyId: "company-1",
          status: "active",
          deleted: false,
        },
        orderBy: { name: "asc" },
        include: {
          company: {
            include: {
              tenant: true,
            },
          },
        },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe("create", () => {
    it("should create merchant with generated ID and connect company/tenant", async () => {
      vi.mocked(prisma.merchant.create).mockResolvedValue(mockMerchant as never);

      const createData = {
        slug: "new-restaurant",
        name: "New Restaurant",
        address: "456 Oak St",
        city: "Boston",
        state: "MA",
        zipCode: "02101",
        country: "US",
        phone: "(617) 555-0100",
        email: "info@newrestaurant.com",
        timezone: "America/New_York",
        currency: "USD",
        locale: "en-US",
      };

      const result = await repository.create("company-1", "tenant-1", createData);

      expect(prisma.merchant.create).toHaveBeenCalledWith({
        data: {
          id: "generated-id-123",
          ...createData,
          company: { connect: { id: "company-1" } },
          tenant: { connect: { id: "tenant-1" } },
        },
      });
      expect(result).toEqual(mockMerchant);
    });
  });

  describe("update", () => {
    it("should update merchant by ID", async () => {
      vi.mocked(prisma.merchant.update).mockResolvedValue({
        ...mockMerchant,
        name: "Updated Name",
      } as never);

      const result = await repository.update("merchant-1", { name: "Updated Name" });

      expect(prisma.merchant.update).toHaveBeenCalledWith({
        where: { id: "merchant-1" },
        data: { name: "Updated Name" },
      });
      expect(result.name).toBe("Updated Name");
    });
  });

  describe("updateSettings", () => {
    it("should update settings with company/tenant include", async () => {
      const settings = { acceptsPickup: true, acceptsDelivery: false };
      vi.mocked(prisma.merchant.update).mockResolvedValue({
        ...mockMerchantWithCompany,
        settings,
      } as never);

      const result = await repository.updateSettings("merchant-1", settings);

      expect(prisma.merchant.update).toHaveBeenCalledWith({
        where: { id: "merchant-1" },
        data: { settings },
        include: {
          company: {
            include: {
              tenant: true,
            },
          },
        },
      });
      expect(result.settings).toEqual(settings);
    });
  });

  describe("isSlugAvailable", () => {
    it("should return true when no merchant with slug exists", async () => {
      vi.mocked(prisma.merchant.findFirst).mockResolvedValue(null);

      const result = await repository.isSlugAvailable("new-slug");

      expect(prisma.merchant.findFirst).toHaveBeenCalledWith({
        where: { slug: "new-slug", deleted: false },
        select: { id: true },
      });
      expect(result).toBe(true);
    });

    it("should return false when slug is taken by another merchant", async () => {
      vi.mocked(prisma.merchant.findFirst).mockResolvedValue({ id: "other-merchant" } as never);

      const result = await repository.isSlugAvailable("taken-slug");

      expect(result).toBe(false);
    });

    it("should return true when slug belongs to excluded merchant", async () => {
      vi.mocked(prisma.merchant.findFirst).mockResolvedValue({ id: "merchant-1" } as never);

      const result = await repository.isSlugAvailable("my-slug", "merchant-1");

      expect(result).toBe(true);
    });

    it("should return false when slug belongs to different merchant even with excludeId", async () => {
      vi.mocked(prisma.merchant.findFirst).mockResolvedValue({ id: "other-merchant" } as never);

      const result = await repository.isSlugAvailable("taken-slug", "merchant-1");

      expect(result).toBe(false);
    });
  });

  describe("isOpen", () => {
    it("should return false when merchant not found", async () => {
      vi.mocked(prisma.merchant.findUnique).mockResolvedValue(null);

      const result = await repository.isOpen("non-existent");

      expect(result).toBe(false);
    });

    it("should return false when merchant has no business hours", async () => {
      vi.mocked(prisma.merchant.findUnique).mockResolvedValue({
        ...mockMerchant,
        businessHours: null,
      } as never);

      const result = await repository.isOpen("merchant-1");

      expect(result).toBe(false);
    });

    it("should return false when today is marked as closed", async () => {
      const now = new Date();
      const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      const currentDay = dayNames[now.getDay()];

      vi.mocked(prisma.merchant.findUnique).mockResolvedValue({
        ...mockMerchant,
        businessHours: {
          [currentDay]: { open: "09:00", close: "22:00", closed: true },
        },
      } as never);

      const result = await repository.isOpen("merchant-1");

      expect(result).toBe(false);
    });

    it("should return false when no hours defined for today", async () => {
      // Create business hours that exclude the current day
      const now = new Date();
      const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      const currentDay = dayNames[now.getDay()];

      // Build hours for all days except today
      const hours: Record<string, { open: string; close: string }> = {};
      for (const day of dayNames) {
        if (day !== currentDay) {
          hours[day] = { open: "09:00", close: "22:00" };
        }
      }

      vi.mocked(prisma.merchant.findUnique).mockResolvedValue({
        ...mockMerchant,
        businessHours: hours,
      } as never);

      const result = await repository.isOpen("merchant-1");

      expect(result).toBe(false);
    });

    it("should return true when current time is within business hours", async () => {
      const now = new Date();
      const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      const currentDay = dayNames[now.getDay()];

      // Set hours to cover the entire day
      vi.mocked(prisma.merchant.findUnique).mockResolvedValue({
        ...mockMerchant,
        businessHours: {
          [currentDay]: { open: "00:00", close: "23:59" },
        },
      } as never);

      const result = await repository.isOpen("merchant-1");

      expect(result).toBe(true);
    });

    it("should return false when current time is outside business hours", async () => {
      const now = new Date();
      const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      const currentDay = dayNames[now.getDay()];
      const currentTime = now.toTimeString().slice(0, 5);

      // Set hours that definitely exclude current time
      // If current time is before noon, set hours after noon; otherwise before noon
      const isBeforeNoon = currentTime < "12:00";
      const businessHours = isBeforeNoon
        ? { open: "13:00", close: "14:00" }
        : { open: "01:00", close: "02:00" };

      vi.mocked(prisma.merchant.findUnique).mockResolvedValue({
        ...mockMerchant,
        businessHours: {
          [currentDay]: businessHours,
        },
      } as never);

      const result = await repository.isOpen("merchant-1");

      expect(result).toBe(false);
    });
  });

  describe("delete", () => {
    it("should soft delete merchant by setting deleted=true", async () => {
      vi.mocked(prisma.merchant.update).mockResolvedValue({
        ...mockMerchant,
        deleted: true,
      } as never);

      const result = await repository.delete("merchant-1");

      expect(prisma.merchant.update).toHaveBeenCalledWith({
        where: { id: "merchant-1" },
        data: { deleted: true, updatedAt: expect.any(Date) },
      });
      expect(result.deleted).toBe(true);
    });
  });
});
