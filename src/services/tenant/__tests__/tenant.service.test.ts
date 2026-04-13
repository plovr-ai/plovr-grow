import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/repositories/tenant.repository", () => ({
  tenantRepository: {
    getById: vi.fn(),
    getBySlug: vi.fn(),
    getWithMerchants: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/repositories/merchant.repository", () => ({
  merchantRepository: {
    isSlugAvailable: vi.fn(),
  },
}));

vi.mock("@/services/generator/slug.util", () => ({
  generateUniqueSlug: vi.fn(
    (name: string, _checker: (slug: string) => Promise<boolean>) =>
      Promise.resolve(name.toLowerCase().replace(/\s+/g, "-"))
  ),
}));

vi.mock("@/lib/db", () => ({
  default: {
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        tenant: { update: vi.fn() },
        merchant: { update: vi.fn() },
      })
    ),
  },
}));

vi.mock("@/lib/id", () => ({
  generateEntityId: vi.fn(() => "generated-id"),
}));

import { tenantRepository } from "@/repositories/tenant.repository";
import { TenantService } from "../tenant.service";

describe("TenantService", () => {
  let service: TenantService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TenantService();
  });

  describe("updateFromPlaceDetails() - review filtering", () => {
    const baseTenant = {
      id: "tenant-1",
      slug: "old-slug",
      name: "Old Name",
      settings: {},
      merchants: [{ id: "merchant-1", slug: "old-merchant-slug" }],
    };

    beforeEach(() => {
      vi.mocked(tenantRepository.getWithMerchants).mockResolvedValue(
        baseTenant as never
      );
    });

    it("should filter reviews to only include rating >= 4", async () => {
      const details = {
        name: "Test Restaurant",
        address: "123 Main St",
        city: "New York",
        state: "NY",
        zipCode: "10001",
        reviews: [
          { author: "Alice", rating: 5, text: "Amazing!" },
          { author: "Bob", rating: 3, text: "Okay" },
          { author: "Carol", rating: 4, text: "Good" },
          { author: "Dave", rating: 2, text: "Bad" },
        ],
      };

      await service.updateFromPlaceDetails("tenant-1", details);

      // The $transaction mock captures the function; we verify via the
      // mock implementation that the settings passed contain filtered reviews.
      const { default: prisma } = await import("@/lib/db");
      const txFn = vi.mocked(prisma.$transaction).mock.calls[0][0] as (
        tx: unknown
      ) => Promise<unknown>;

      // Re-run the transaction function with a spy to capture arguments
      const tenantUpdateSpy = vi.fn();
      const merchantUpdateSpy = vi.fn();
      await txFn({
        tenant: { update: tenantUpdateSpy },
        merchant: { update: merchantUpdateSpy },
      });

      const settingsArg = tenantUpdateSpy.mock.calls[0][0].data.settings;
      expect(settingsArg.website.reviews).toHaveLength(2);
      expect(settingsArg.website.reviews.map((r: { author: string }) => r.author)).toEqual([
        "Alice",
        "Carol",
      ]);
    });

    it("should include reviews with exactly 4 stars", async () => {
      const details = {
        name: "Test Restaurant",
        address: "123 Main St",
        city: "New York",
        state: "NY",
        zipCode: "10001",
        reviews: [{ author: "Carol", rating: 4, text: "Good" }],
      };

      await service.updateFromPlaceDetails("tenant-1", details);

      const { default: prisma } = await import("@/lib/db");
      const txFn = vi.mocked(prisma.$transaction).mock.calls[0][0] as (
        tx: unknown
      ) => Promise<unknown>;

      const tenantUpdateSpy = vi.fn();
      await txFn({
        tenant: { update: tenantUpdateSpy },
        merchant: { update: vi.fn() },
      });

      const settingsArg = tenantUpdateSpy.mock.calls[0][0].data.settings;
      expect(settingsArg.website.reviews).toHaveLength(1);
      expect(settingsArg.website.reviews[0].author).toBe("Carol");
    });

    it("should return empty reviews when all are below 4 stars", async () => {
      const details = {
        name: "Test Restaurant",
        address: "123 Main St",
        city: "New York",
        state: "NY",
        zipCode: "10001",
        reviews: [
          { author: "Bob", rating: 3, text: "Okay" },
          { author: "Dave", rating: 1, text: "Bad" },
        ],
      };

      await service.updateFromPlaceDetails("tenant-1", details);

      const { default: prisma } = await import("@/lib/db");
      const txFn = vi.mocked(prisma.$transaction).mock.calls[0][0] as (
        tx: unknown
      ) => Promise<unknown>;

      const tenantUpdateSpy = vi.fn();
      await txFn({
        tenant: { update: tenantUpdateSpy },
        merchant: { update: vi.fn() },
      });

      const settingsArg = tenantUpdateSpy.mock.calls[0][0].data.settings;
      expect(settingsArg.website.reviews).toEqual([]);
    });

    it("should limit filtered reviews to 5", async () => {
      const details = {
        name: "Test Restaurant",
        address: "123 Main St",
        city: "New York",
        state: "NY",
        zipCode: "10001",
        reviews: [
          { author: "A", rating: 5, text: "Great" },
          { author: "B", rating: 5, text: "Great" },
          { author: "C", rating: 5, text: "Great" },
          { author: "D", rating: 4, text: "Good" },
          { author: "E", rating: 4, text: "Good" },
          { author: "F", rating: 5, text: "Great" },
          { author: "G", rating: 4, text: "Good" },
        ],
      };

      await service.updateFromPlaceDetails("tenant-1", details);

      const { default: prisma } = await import("@/lib/db");
      const txFn = vi.mocked(prisma.$transaction).mock.calls[0][0] as (
        tx: unknown
      ) => Promise<unknown>;

      const tenantUpdateSpy = vi.fn();
      await txFn({
        tenant: { update: tenantUpdateSpy },
        merchant: { update: vi.fn() },
      });

      const settingsArg = tenantUpdateSpy.mock.calls[0][0].data.settings;
      expect(settingsArg.website.reviews).toHaveLength(5);
    });

    it("should handle undefined reviews", async () => {
      const details = {
        name: "Test Restaurant",
        address: "123 Main St",
        city: "New York",
        state: "NY",
        zipCode: "10001",
      };

      await service.updateFromPlaceDetails("tenant-1", details);

      const { default: prisma } = await import("@/lib/db");
      const txFn = vi.mocked(prisma.$transaction).mock.calls[0][0] as (
        tx: unknown
      ) => Promise<unknown>;

      const tenantUpdateSpy = vi.fn();
      await txFn({
        tenant: { update: tenantUpdateSpy },
        merchant: { update: vi.fn() },
      });

      const settingsArg = tenantUpdateSpy.mock.calls[0][0].data.settings;
      expect(settingsArg.website.reviews).toEqual([]);
    });
  });
});
