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

  const mockTenant = {
    id: "tenant-1",
    slug: "joes-pizza",
    name: "Joe's Pizza",
    logoUrl: "https://example.com/logo.png",
    settings: {},
    subscriptionStatus: "active",
  };

  const mockMerchantWithTenant = {
    ...mockMerchant,
    tenant: mockTenant,
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
    it("should return merchants for a tenant ordered by name", async () => {
      vi.mocked(prisma.merchant.findMany).mockResolvedValue([mockMerchant] as never);

      const result = await repository.getByTenantId("tenant-1");

      expect(prisma.merchant.findMany).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1", deleted: false },
        orderBy: { name: "asc" },
      });
      expect(result).toHaveLength(1);
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

  describe("getBySlugWithTenant", () => {
    it("should find merchant by slug with tenant included", async () => {
      vi.mocked(prisma.merchant.findFirst).mockResolvedValue(mockMerchantWithTenant as never);

      const result = await repository.getBySlugWithTenant("joes-pizza-downtown");

      expect(prisma.merchant.findFirst).toHaveBeenCalledWith({
        where: { slug: "joes-pizza-downtown", deleted: false },
        include: {
          tenant: true,
        },
      });
      expect(result).toEqual(mockMerchantWithTenant);
    });

    it("should return null for non-existent slug", async () => {
      vi.mocked(prisma.merchant.findFirst).mockResolvedValue(null);

      const result = await repository.getBySlugWithTenant("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("getActiveByTenantId", () => {
    it("should return only active merchants", async () => {
      vi.mocked(prisma.merchant.findMany).mockResolvedValue([mockMerchant] as never);

      const result = await repository.getActiveByTenantId("tenant-1");

      expect(prisma.merchant.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-1",
          status: "active",
          deleted: false,
        },
        orderBy: { name: "asc" },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe("getByIdWithTenant", () => {
    it("should find merchant by ID with tenant", async () => {
      vi.mocked(prisma.merchant.findUnique).mockResolvedValue(mockMerchantWithTenant as never);

      const result = await repository.getByIdWithTenant("merchant-1");

      expect(prisma.merchant.findUnique).toHaveBeenCalledWith({
        where: { id: "merchant-1", deleted: false },
        include: {
          tenant: true,
        },
      });
      expect(result).toEqual(mockMerchantWithTenant);
    });
  });

  describe("getByTenantIdWithTenant", () => {
    it("should return merchants with tenant info", async () => {
      vi.mocked(prisma.merchant.findMany).mockResolvedValue([mockMerchantWithTenant] as never);

      const result = await repository.getByTenantIdWithTenant("tenant-1");

      expect(prisma.merchant.findMany).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1", deleted: false },
        orderBy: { name: "asc" },
        include: {
          tenant: true,
        },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe("getActiveByTenantIdWithTenant", () => {
    it("should return active merchants with tenant info", async () => {
      vi.mocked(prisma.merchant.findMany).mockResolvedValue([mockMerchantWithTenant] as never);

      const result = await repository.getActiveByTenantIdWithTenant("tenant-1");

      expect(prisma.merchant.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-1",
          status: "active",
          deleted: false,
        },
        orderBy: { name: "asc" },
        include: {
          tenant: true,
        },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe("create", () => {
    it("should create merchant with generated ID and connect tenant", async () => {
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

      const result = await repository.create("tenant-1", createData);

      expect(prisma.merchant.create).toHaveBeenCalledWith({
        data: {
          id: "generated-id-123",
          ...createData,
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
    it("should update settings with tenant include", async () => {
      const settings = { acceptsPickup: true, acceptsDelivery: false };
      vi.mocked(prisma.merchant.update).mockResolvedValue({
        ...mockMerchantWithTenant,
        settings,
      } as never);

      const result = await repository.updateSettings("merchant-1", settings);

      expect(prisma.merchant.update).toHaveBeenCalledWith({
        where: { id: "merchant-1" },
        data: { settings },
        include: {
          tenant: true,
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
      const now = new Date();
      const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      const currentDay = dayNames[now.getDay()];

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
