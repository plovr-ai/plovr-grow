import { describe, it, expect, vi, beforeEach } from "vitest";
import { merchantService } from "../merchant.service";
import { Prisma } from "@prisma/client";
import { AppError, ErrorCodes } from "@/lib/errors";

// Mock repositories
vi.mock("@/repositories/merchant.repository", () => ({
  merchantRepository: {
    getBySlugWithTenant: vi.fn(),
    getByIdWithTenant: vi.fn(),
    getByTenantIdWithTenant: vi.fn(),
    getActiveByTenantIdWithTenant: vi.fn(),
    getByAiPhone: vi.fn(),
    isSlugAvailable: vi.fn(),
    isOpen: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateSettings: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/repositories/tenant.repository", () => ({
  tenantRepository: {
    getById: vi.fn(),
    getBySlugWithMerchants: vi.fn(),
  },
}));

vi.mock("@/services/menu", () => ({
  menuService: {
    getMenuItemsByTenantId: vi.fn(),
    getFeaturedItems: vi.fn(),
  },
}));

// Import mocked modules
import { merchantRepository } from "@/repositories/merchant.repository";
import { tenantRepository } from "@/repositories/tenant.repository";
import { menuService } from "@/services/menu";

describe("MerchantService (unit tests)", () => {
  // Mock data
  const mockTenantWithMerchants = {
    id: "tenant-1",
    tenantId: "tenant-1",
    slug: "joes-pizza",
    name: "Joe's Pizza",
    legalName: "Joe's Pizza Inc.",
    description: "Best pizza in town",
    logoUrl: "https://example.com/logo.png",
    websiteUrl: "https://joespizza.com",
    supportEmail: "support@joespizza.com",
    supportPhone: "(212) 555-0100",
    taxId: null,
    status: "active",
    onboardingStatus: "completed",
    onboardingData: null,
    onboardingCompletedAt: null,
    stripeConnectStatus: null,
    currency: "USD",
    locale: "en-US",
    timezone: "America/New_York",
    settings: {
      defaultCurrency: "USD",
      defaultLocale: "en-US",
      website: {
        tagline: "Best pizza in NYC",
        heroImage: "https://example.com/hero.jpg",
        socialLinks: [
          { platform: "facebook", url: "https://facebook.com/joespizza" },
        ],
        featuredItemIds: ["item-cheese-pizza", "item-pepperoni-pizza"],
        reviews: [
          {
            id: "review-1",
            customerName: "John D.",
            rating: 5,
            content: "Great pizza!",
            date: "2024-01-10",
            source: "google",
          },
        ],
      },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    merchants: [
      {
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
        businessHours: {},
        timezone: "America/New_York",
        currency: "USD",
        locale: "en-US",
        status: "active",
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };

  const _mockMenuItems = [
    {
      id: "item-cheese-pizza",
      tenantId: "tenant-1",
            categoryId: "cat-pizza",
      name: "Classic Cheese Pizza",
      description: "Fresh mozzarella and tomato sauce",
      price: new Prisma.Decimal(18.99),
      imageUrl: "https://example.com/pizza.jpg",
      sortOrder: 1,
      status: "active",
      options: null,
      nutrition: null,
      tags: ["vegetarian"],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "item-pepperoni-pizza",
      tenantId: "tenant-1",
            categoryId: "cat-pizza",
      name: "Pepperoni Pizza",
      description: "Classic pepperoni with mozzarella",
      price: new Prisma.Decimal(21.99),
      imageUrl: "https://example.com/pepperoni.jpg",
      sortOrder: 2,
      status: "active",
      options: [
        {
          id: "size",
          name: "Size",
          type: "single",
          required: true,
          modifiers: [
            { id: "size-s", name: "Small", price: 0 },
            { id: "size-l", name: "Large", price: 4 },
          ],
        },
      ],
      nutrition: null,
      tags: ["popular"],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTenantWebsiteData()", () => {
    // Mock data for featured items (matching FeaturedItemData type)
    const mockFeaturedItemsData = [
      {
        id: "featured-1",
        menuItemId: "item-cheese-pizza",
        sortOrder: 1,
        menuItem: {
          id: "item-cheese-pizza",
          name: "Classic Cheese Pizza",
          description: "Fresh mozzarella and tomato sauce",
          price: new Prisma.Decimal(18.99),
          imageUrl: "https://example.com/pizza.jpg",
          status: "active",
          modifierGroups: null,
        },
      },
      {
        id: "featured-2",
        menuItemId: "item-pepperoni-pizza",
        sortOrder: 2,
        menuItem: {
          id: "item-pepperoni-pizza",
          name: "Pepperoni Pizza",
          description: "Classic pepperoni",
          price: new Prisma.Decimal(21.99),
          imageUrl: "https://example.com/pepperoni.jpg",
          status: "active",
          modifierGroups: [{ id: "mod-1", name: "Size" }],
        },
      },
    ];

    beforeEach(() => {
      vi.mocked(tenantRepository.getBySlugWithMerchants).mockResolvedValue(
        mockTenantWithMerchants as never
      );
      vi.mocked(menuService.getFeaturedItems).mockResolvedValue(
        mockFeaturedItemsData as never
      );
    });

    it("should return website data with company info", async () => {
      const result = await merchantService.getTenantWebsiteData("joes-pizza");

      expect(result).not.toBeNull();
      expect(result?.name).toBe("Joe's Pizza");
      expect(result?.tagline).toBe("Best pizza in NYC");
      expect(result?.logo).toBe("https://example.com/logo.png");
      expect(result?.heroImage).toBe("https://example.com/hero.jpg");
    });

    it("should fetch featured items from menu database", async () => {
      const result = await merchantService.getTenantWebsiteData("joes-pizza");

      expect(menuService.getFeaturedItems).toHaveBeenCalledWith(
        "tenant-1"
      );
      expect(result?.featuredItems).toHaveLength(2);
    });

    it("should map menu items to FeaturedItem format", async () => {
      const result = await merchantService.getTenantWebsiteData("joes-pizza");

      const featuredItems = result?.featuredItems;
      expect(featuredItems?.[0]).toMatchObject({
        id: "featured-1",
        name: "Classic Cheese Pizza",
        description: "Fresh mozzarella and tomato sauce",
        image: "https://example.com/pizza.jpg",
        menuItemId: "item-cheese-pizza",
        hasModifiers: false,
      });
      // Price is a Prisma Decimal, check separately
      expect(Number(featuredItems?.[0]?.price)).toBe(18.99);
    });

    it("should set hasModifiers to false in current implementation", async () => {
      // NOTE: The current implementation always sets hasModifiers to false
      // as fetching modifier options would require additional queries
      const result = await merchantService.getTenantWebsiteData("joes-pizza");

      const pepperoniItem = result?.featuredItems?.find(
        (item) => item.id === "featured-2"
      );
      expect(pepperoniItem?.hasModifiers).toBe(false);
    });

    it("should return empty featuredItems when no featured items configured", async () => {
      vi.mocked(menuService.getFeaturedItems).mockResolvedValue([]);

      const result = await merchantService.getTenantWebsiteData("joes-pizza");

      expect(menuService.getFeaturedItems).toHaveBeenCalledWith(
        "tenant-1"
      );
      expect(result?.featuredItems).toEqual([]);
    });

    it("should return empty featuredItems when getFeaturedItems returns empty", async () => {
      vi.mocked(menuService.getFeaturedItems).mockResolvedValue([]);

      const result = await merchantService.getTenantWebsiteData("joes-pizza");

      expect(result?.featuredItems).toEqual([]);
    });

    it("should handle missing imageUrl gracefully", async () => {
      vi.mocked(menuService.getFeaturedItems).mockResolvedValue([
        {
          id: "featured-1",
          menuItemId: "item-1",
          sortOrder: 1,
          menuItem: {
            id: "item-1",
            name: "Test Item",
            description: "Test description",
            price: new Prisma.Decimal(10.00),
            imageUrl: null,
            status: "active",
            modifierGroups: null,
          },
        },
      ] as never);

      const result = await merchantService.getTenantWebsiteData("joes-pizza");

      expect(result?.featuredItems?.[0].image).toBe("");
    });

    it("should handle missing description gracefully", async () => {
      vi.mocked(menuService.getFeaturedItems).mockResolvedValue([
        {
          id: "featured-1",
          menuItemId: "item-1",
          sortOrder: 1,
          menuItem: {
            id: "item-1",
            name: "Test Item",
            description: null,
            price: new Prisma.Decimal(10.00),
            imageUrl: "https://example.com/image.jpg",
            status: "active",
            modifierGroups: null,
          },
        },
      ] as never);

      const result = await merchantService.getTenantWebsiteData("joes-pizza");

      expect(result?.featuredItems?.[0].description).toBe("");
    });

    it("should return reviews from company settings", async () => {
      const result = await merchantService.getTenantWebsiteData("joes-pizza");

      expect(result?.reviews).toHaveLength(1);
      expect(result?.reviews?.[0].customerName).toBe("John D.");
    });

    it("should return socialLinks from company settings", async () => {
      const result = await merchantService.getTenantWebsiteData("joes-pizza");

      expect(result?.socialLinks).toHaveLength(1);
      expect(result?.socialLinks[0].platform).toBe("facebook");
    });

    it("should return null for non-existent company", async () => {
      vi.mocked(tenantRepository.getBySlugWithMerchants).mockResolvedValue(
        null as never
      );

      const result = await merchantService.getTenantWebsiteData("non-existent");

      expect(result).toBeNull();
    });

    it("should use default currency and locale when not configured", async () => {
      vi.mocked(tenantRepository.getBySlugWithMerchants).mockResolvedValue({
        ...mockTenantWithMerchants,
        settings: null,
      } as never);

      const result = await merchantService.getTenantWebsiteData("joes-pizza");

      expect(result?.currency).toBe("USD");
      expect(result?.locale).toBe("en-US");
    });

    it("should use company description as tagline fallback when website tagline missing", async () => {
      vi.mocked(tenantRepository.getBySlugWithMerchants).mockResolvedValue({
        ...mockTenantWithMerchants,
        settings: { website: {} },
      } as never);
      vi.mocked(menuService.getFeaturedItems).mockResolvedValue([]);

      const result = await merchantService.getTenantWebsiteData("joes-pizza");

      expect(result?.tagline).toBe("Best pizza in town");
    });

    it("should use empty tagline when no website tagline and no description", async () => {
      vi.mocked(tenantRepository.getBySlugWithMerchants).mockResolvedValue({
        ...mockTenantWithMerchants,
        description: null,
        settings: { website: {} },
      } as never);
      vi.mocked(menuService.getFeaturedItems).mockResolvedValue([]);

      const result = await merchantService.getTenantWebsiteData("joes-pizza");

      expect(result?.tagline).toBe("");
    });

    it("should include merchant contact info for single-merchant company", async () => {
      vi.mocked(tenantRepository.getBySlugWithMerchants).mockResolvedValue(
        mockTenantWithMerchants as never
      );
      vi.mocked(menuService.getFeaturedItems).mockResolvedValue([]);

      const result = await merchantService.getTenantWebsiteData("joes-pizza");

      // Single merchant company - should have merchant contact info
      expect(result?.address).toBe("123 Main St");
      expect(result?.city).toBe("New York");
      expect(result?.state).toBe("NY");
      expect(result?.phone).toBe("(212) 555-0100");
      expect(result?.email).toBe("downtown@joespizza.com");
    });

    it("should exclude merchant contact info for multi-merchant company", async () => {
      const multiMerchantCompany = {
        ...mockTenantWithMerchants,
        merchants: [
          mockTenantWithMerchants.merchants[0],
          {
            ...mockTenantWithMerchants.merchants[0],
            id: "merchant-2",
            slug: "joes-pizza-midtown",
            name: "Joe's Pizza - Midtown",
          },
        ],
      };
      vi.mocked(tenantRepository.getBySlugWithMerchants).mockResolvedValue(
        multiMerchantCompany as never
      );
      vi.mocked(menuService.getFeaturedItems).mockResolvedValue([]);

      const result = await merchantService.getTenantWebsiteData("joes-pizza");

      expect(result?.address).toBe("");
      expect(result?.city).toBe("");
      expect(result?.phone).toBe("");
    });

    it("should filter out inactive featured items", async () => {
      vi.mocked(menuService.getFeaturedItems).mockResolvedValue([
        {
          id: "featured-1",
          menuItemId: "item-1",
          sortOrder: 1,
          menuItem: {
            id: "item-1",
            name: "Active Item",
            description: "Active",
            price: new Prisma.Decimal(10.0),
            imageUrl: null,
            status: "active",
            modifierGroups: null,
          },
        },
        {
          id: "featured-2",
          menuItemId: "item-2",
          sortOrder: 2,
          menuItem: {
            id: "item-2",
            name: "Inactive Item",
            description: "Inactive",
            price: new Prisma.Decimal(15.0),
            imageUrl: null,
            status: "inactive",
            modifierGroups: null,
          },
        },
      ] as never);

      const result = await merchantService.getTenantWebsiteData("joes-pizza");

      expect(result?.featuredItems).toHaveLength(1);
      expect(result?.featuredItems?.[0].name).toBe("Active Item");
    });

    it("should default logo to empty string when company logoUrl is null", async () => {
      vi.mocked(tenantRepository.getBySlugWithMerchants).mockResolvedValue({
        ...mockTenantWithMerchants,
        logoUrl: null,
      } as never);
      vi.mocked(menuService.getFeaturedItems).mockResolvedValue([]);

      const result = await merchantService.getTenantWebsiteData("joes-pizza");

      expect(result?.logo).toBe("");
    });

    it("should return empty reviews when not configured", async () => {
      vi.mocked(tenantRepository.getBySlugWithMerchants).mockResolvedValue({
        ...mockTenantWithMerchants,
        settings: { website: {} },
      } as never);
      vi.mocked(menuService.getFeaturedItems).mockResolvedValue([]);

      const result = await merchantService.getTenantWebsiteData("joes-pizza");

      expect(result?.reviews).toEqual([]);
    });

    it("should map Google Places review fields (author/text) to CustomerReview format (customerName/content)", async () => {
      vi.mocked(tenantRepository.getBySlugWithMerchants).mockResolvedValue({
        ...mockTenantWithMerchants,
        settings: {
          website: {
            reviews: [
              {
                author: "Jane S.",
                text: "Amazing food and great service!",
                rating: 4,
                source: "google",
              },
            ],
          },
        },
      } as never);
      vi.mocked(menuService.getFeaturedItems).mockResolvedValue([]);

      const result = await merchantService.getTenantWebsiteData("joes-pizza");

      expect(result?.reviews).toHaveLength(1);
      expect(result?.reviews?.[0].customerName).toBe("Jane S.");
      expect(result?.reviews?.[0].content).toBe("Amazing food and great service!");
      expect(result?.reviews?.[0].rating).toBe(4);
      expect(result?.reviews?.[0].source).toBe("google");
    });

    it("should fallback to 'Anonymous' when both customerName and author are empty strings", async () => {
      vi.mocked(tenantRepository.getBySlugWithMerchants).mockResolvedValue({
        ...mockTenantWithMerchants,
        settings: {
          website: {
            reviews: [
              {
                customerName: "",
                author: "",
                text: "Good food",
                rating: 4,
              },
            ],
          },
        },
      } as never);
      vi.mocked(menuService.getFeaturedItems).mockResolvedValue([]);

      const result = await merchantService.getTenantWebsiteData("joes-pizza");

      expect(result?.reviews).toHaveLength(1);
      expect(result?.reviews?.[0].customerName).toBe("Anonymous");
    });

    it("should return empty reviews array when no reviews in tenant settings", async () => {
      vi.mocked(tenantRepository.getBySlugWithMerchants).mockResolvedValue({
        ...mockTenantWithMerchants,
        settings: {
          website: {
            tagline: "Some tagline",
          },
        },
      } as never);
      vi.mocked(menuService.getFeaturedItems).mockResolvedValue([]);

      const result = await merchantService.getTenantWebsiteData("joes-pizza");

      expect(result?.reviews).toEqual([]);
    });

    it("should filter out reviews with rating below 4", async () => {
      vi.mocked(tenantRepository.getBySlugWithMerchants).mockResolvedValue({
        ...mockTenantWithMerchants,
        settings: {
          website: {
            reviews: [
              { id: "r1", customerName: "Alice", rating: 5, content: "Amazing!", date: "2024-01-01", source: "google" },
              { id: "r2", customerName: "Bob", rating: 3, content: "Okay", date: "2024-01-02", source: "google" },
              { id: "r3", customerName: "Carol", rating: 4, content: "Good", date: "2024-01-03", source: "google" },
              { id: "r4", customerName: "Dave", rating: 2, content: "Bad", date: "2024-01-04", source: "google" },
              { id: "r5", customerName: "Eve", rating: 1, content: "Terrible", date: "2024-01-05", source: "google" },
            ],
          },
        },
      } as never);
      vi.mocked(menuService.getFeaturedItems).mockResolvedValue([]);

      const result = await merchantService.getTenantWebsiteData("joes-pizza");

      expect(result?.reviews).toHaveLength(2);
      expect(result?.reviews?.map((r) => r.customerName)).toEqual(["Alice", "Carol"]);
    });

    it("should include reviews with exactly 4 stars", async () => {
      vi.mocked(tenantRepository.getBySlugWithMerchants).mockResolvedValue({
        ...mockTenantWithMerchants,
        settings: {
          website: {
            reviews: [
              { id: "r1", customerName: "Alice", rating: 4, content: "Good", date: "2024-01-01", source: "google" },
            ],
          },
        },
      } as never);
      vi.mocked(menuService.getFeaturedItems).mockResolvedValue([]);

      const result = await merchantService.getTenantWebsiteData("joes-pizza");

      expect(result?.reviews).toHaveLength(1);
      expect(result?.reviews?.[0].customerName).toBe("Alice");
    });

    it("should skip tenant lookup when preloadedTenant is provided", async () => {
      vi.mocked(menuService.getFeaturedItems).mockResolvedValue([]);

      const result = await merchantService.getTenantWebsiteData("joes-pizza", {
        preloadedTenant: mockTenantWithMerchants as never,
      });

      expect(tenantRepository.getBySlugWithMerchants).not.toHaveBeenCalled();
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Joe's Pizza");
      expect(menuService.getFeaturedItems).toHaveBeenCalledWith("tenant-1");
    });

    it("should still query repository when preloadedTenant is undefined", async () => {
      vi.mocked(menuService.getFeaturedItems).mockResolvedValue([]);

      await merchantService.getTenantWebsiteData("joes-pizza", {});

      expect(tenantRepository.getBySlugWithMerchants).toHaveBeenCalledWith("joes-pizza");
    });

    it("should return empty array when all reviews are below 4 stars", async () => {
      vi.mocked(tenantRepository.getBySlugWithMerchants).mockResolvedValue({
        ...mockTenantWithMerchants,
        settings: {
          website: {
            reviews: [
              { id: "r1", customerName: "Bob", rating: 3, content: "Meh", date: "2024-01-01", source: "google" },
              { id: "r2", customerName: "Dave", rating: 1, content: "Bad", date: "2024-01-02", source: "google" },
            ],
          },
        },
      } as never);
      vi.mocked(menuService.getFeaturedItems).mockResolvedValue([]);

      const result = await merchantService.getTenantWebsiteData("joes-pizza");

      expect(result?.reviews).toEqual([]);
    });
  });

  // ==================== getMerchantBySlug ====================
  // Note: getMerchantBySlug is wrapped with React `cache()` (#303) to dedupe
  // repeated calls with the same slug within a single Next.js server request
  // (generateMetadata / layout.tsx / page.tsx run independently but should
  // share a cached result). React `cache()` only dedupes inside a React
  // Server Component render context; outside that context each invocation
  // runs fresh, which is why these tests still observe the underlying
  // repository call every time. See React docs: https://react.dev/reference/react/cache
  describe("getMerchantBySlug()", () => {
    const mockPrismaMerchantWithTenant = {
      id: "merchant-1",
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
      businessHours: {},
      timezone: "America/New_York",
      currency: "USD",
      locale: "en-US",
      status: "active",
      settings: null,
      deleted: false,
      tenantId: "tenant-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      tenant: {
        id: "tenant-1",
        slug: "joes-pizza",
        name: "Joe's Pizza",
        logoUrl: null,
        settings: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    it("should return mapped merchant data for valid slug", async () => {
      vi.mocked(merchantRepository.getBySlugWithTenant).mockResolvedValue(
        mockPrismaMerchantWithTenant as never
      );

      const result = await merchantService.getMerchantBySlug("joes-pizza-downtown");

      expect(merchantRepository.getBySlugWithTenant).toHaveBeenCalledWith("joes-pizza-downtown");
      expect(result).not.toBeNull();
      expect(result?.id).toBe("merchant-1");
      expect(result?.slug).toBe("joes-pizza-downtown");
      expect(result?.tenant.tenantId).toBe("tenant-1");
    });

    it("should return null for non-existent slug", async () => {
      vi.mocked(merchantRepository.getBySlugWithTenant).mockResolvedValue(null);

      const result = await merchantService.getMerchantBySlug("non-existent");

      expect(result).toBeNull();
    });
  });

  // ==================== getMerchantBySlugWithTenant ====================
  describe("getMerchantBySlugWithTenant()", () => {
    it("should delegate to getMerchantBySlug", async () => {
      vi.mocked(merchantRepository.getBySlugWithTenant).mockResolvedValue(null);

      const result = await merchantService.getMerchantBySlugWithTenant("test-slug");

      expect(merchantRepository.getBySlugWithTenant).toHaveBeenCalledWith("test-slug");
      expect(result).toBeNull();
    });
  });

  // ==================== getMerchantById ====================
  describe("getMerchantById()", () => {
    const mockPrismaData = {
      id: "merchant-1",
            slug: "joes-pizza-downtown",
      name: "Joe's Pizza - Downtown",
      description: null,
      address: null,
      city: null,
      state: null,
      zipCode: null,
      country: "US",
      phone: null,
      email: null,
      logoUrl: null,
      bannerUrl: null,
      businessHours: null,
      timezone: "America/New_York",
      currency: "USD",
      locale: "en-US",
      status: "active",
      settings: null,
      deleted: false,
      tenantId: "tenant-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      tenant: {
        id: "tenant-1",
        slug: "joes-pizza",
        name: "Joe's Pizza",
        logoUrl: null,
        settings: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    it("should return merchant for valid ID", async () => {
      vi.mocked(merchantRepository.getByIdWithTenant).mockResolvedValue(mockPrismaData as never);

      const result = await merchantService.getMerchantById("merchant-1");

      expect(merchantRepository.getByIdWithTenant).toHaveBeenCalledWith("merchant-1");
      expect(result?.id).toBe("merchant-1");
    });

    it("should return null when merchant not found", async () => {
      vi.mocked(merchantRepository.getByIdWithTenant).mockResolvedValue(null);

      const result = await merchantService.getMerchantById("non-existent");

      expect(result).toBeNull();
    });
  });

  // ==================== getTenantBySlug ====================
  // Also wrapped with React `cache()` for per-request dedup (#303). Same
  // testing caveat as getMerchantBySlug above.
  describe("getTenantBySlug()", () => {
    it("should return company with merchants for valid slug", async () => {
      vi.mocked(tenantRepository.getBySlugWithMerchants).mockResolvedValue(
        mockTenantWithMerchants as never
      );

      const result = await merchantService.getTenantBySlug("joes-pizza");

      expect(tenantRepository.getBySlugWithMerchants).toHaveBeenCalledWith("joes-pizza");
      expect(result?.id).toBe("tenant-1");
      expect(result?.merchants).toBeDefined();
    });

    it("should return null for non-existent slug", async () => {
      vi.mocked(tenantRepository.getBySlugWithMerchants).mockResolvedValue(null);

      const result = await merchantService.getTenantBySlug("non-existent");

      expect(result).toBeNull();
    });
  });

  // ==================== getWebsiteData ====================
  describe("getWebsiteData()", () => {
    const mockPrismaMerchant = {
      id: "merchant-1",
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
      logoUrl: "https://example.com/merchant-logo.png",
      bannerUrl: "https://example.com/banner.jpg",
      businessHours: { mon: { open: "09:00", close: "22:00" } },
      timezone: "America/New_York",
      currency: "USD",
      locale: "en-US",
      status: "active",
      settings: {
        tipConfig: { mode: "percentage", tiers: [0.15, 0.18, 0.2] },
        feeConfig: { fees: [] },
        website: {
          tagline: "Merchant tagline",
          heroImage: "https://example.com/merchant-hero.jpg",
        },
      },
      deleted: false,
      tenantId: "tenant-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      tenant: {
        id: "tenant-1",
        slug: "joes-pizza",
        name: "Joe's Pizza",
        logoUrl: "https://example.com/company-logo.png",
        settings: {
          website: {
            tagline: "Company tagline",
            heroImage: "https://example.com/company-hero.jpg",
            socialLinks: [{ platform: "facebook", url: "https://facebook.com/joes" }],
          },
        },
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    it("should return null when merchant not found", async () => {
      vi.mocked(merchantRepository.getBySlugWithTenant).mockResolvedValue(null);

      const result = await merchantService.getWebsiteData("non-existent");

      expect(result).toBeNull();
    });

    it("should merge merchant and company data with merchant taking priority", async () => {
      vi.mocked(merchantRepository.getBySlugWithTenant).mockResolvedValue(
        mockPrismaMerchant as never
      );

      const result = await merchantService.getWebsiteData("joes-pizza-downtown");

      expect(result).not.toBeNull();
      expect(result?.name).toBe("Joe's Pizza"); // company name
      expect(result?.tagline).toBe("Merchant tagline"); // merchant overrides company
      expect(result?.heroImage).toBe("https://example.com/merchant-hero.jpg"); // merchant overrides
      expect(result?.address).toBe("123 Main St");
      expect(result?.phone).toBe("(212) 555-0100");
      expect(result?.logo).toBe("https://example.com/merchant-logo.png"); // merchant logo first
      expect(result?.currency).toBe("USD");
      expect(result?.locale).toBe("en-US");
      expect(result?.tipConfig).toBeDefined();
      expect(result?.feeConfig).toBeDefined();
    });

    it("should fall back to company tagline when merchant tagline missing", async () => {
      const merchantNoWebsite = {
        ...mockPrismaMerchant,
        settings: null,
      };
      vi.mocked(merchantRepository.getBySlugWithTenant).mockResolvedValue(
        merchantNoWebsite as never
      );

      const result = await merchantService.getWebsiteData("joes-pizza-downtown");

      expect(result?.tagline).toBe("Company tagline");
    });

    it("should fall back to company heroImage when merchant heroImage missing", async () => {
      const merchantNoWebsite = {
        ...mockPrismaMerchant,
        settings: null,
      };
      vi.mocked(merchantRepository.getBySlugWithTenant).mockResolvedValue(
        merchantNoWebsite as never
      );

      const result = await merchantService.getWebsiteData("joes-pizza-downtown");

      expect(result?.heroImage).toBe("https://example.com/company-hero.jpg");
    });

    it("should fall back to bannerUrl when both merchant and company heroImage missing", async () => {
      const merchantNoBoth = {
        ...mockPrismaMerchant,
        settings: null,
        tenant: {
          ...mockPrismaMerchant.tenant,
          settings: null,
        },
      };
      vi.mocked(merchantRepository.getBySlugWithTenant).mockResolvedValue(
        merchantNoBoth as never
      );

      const result = await merchantService.getWebsiteData("joes-pizza-downtown");

      expect(result?.heroImage).toBe("https://example.com/banner.jpg");
    });

    it("should fall back to company logo when merchant has no logo", async () => {
      const merchantNoLogo = {
        ...mockPrismaMerchant,
        logoUrl: null,
      };
      vi.mocked(merchantRepository.getBySlugWithTenant).mockResolvedValue(
        merchantNoLogo as never
      );

      const result = await merchantService.getWebsiteData("joes-pizza-downtown");

      expect(result?.logo).toBe("https://example.com/company-logo.png");
    });

    it("should return empty strings for missing optional fields", async () => {
      const minimalMerchant = {
        ...mockPrismaMerchant,
        address: null,
        city: null,
        state: null,
        zipCode: null,
        phone: null,
        email: null,
        logoUrl: null,
        bannerUrl: null,
        settings: null,
        tenant: {
          ...mockPrismaMerchant.tenant,
          logoUrl: null,
          settings: null,
        },
      };
      vi.mocked(merchantRepository.getBySlugWithTenant).mockResolvedValue(
        minimalMerchant as never
      );

      const result = await merchantService.getWebsiteData("joes-pizza-downtown");

      expect(result?.address).toBe("");
      expect(result?.city).toBe("");
      expect(result?.state).toBe("");
      expect(result?.zipCode).toBe("");
      expect(result?.phone).toBe("");
      expect(result?.email).toBe("");
      expect(result?.logo).toBe("");
      expect(result?.heroImage).toBe("");
      expect(result?.tagline).toBe("");
      expect(result?.socialLinks).toEqual([]);
    });

    it("should return social links from company settings", async () => {
      vi.mocked(merchantRepository.getBySlugWithTenant).mockResolvedValue(
        mockPrismaMerchant as never
      );

      const result = await merchantService.getWebsiteData("joes-pizza-downtown");

      expect(result?.socialLinks).toHaveLength(1);
      expect(result?.socialLinks[0].platform).toBe("facebook");
    });

    it("should default businessHours to empty object when null", async () => {
      const merchantNullHours = {
        ...mockPrismaMerchant,
        businessHours: null,
      };
      vi.mocked(merchantRepository.getBySlugWithTenant).mockResolvedValue(
        merchantNullHours as never
      );

      const result = await merchantService.getWebsiteData("joes-pizza-downtown");

      expect(result?.businessHours).toEqual({});
    });
  });

  // ==================== getMerchant (protected) ====================
  describe("getMerchant()", () => {
    const mockPrismaData = {
      id: "merchant-1",
            slug: "joes-pizza-downtown",
      name: "Joe's Pizza - Downtown",
      description: null,
      address: null,
      city: null,
      state: null,
      zipCode: null,
      country: "US",
      phone: null,
      email: null,
      logoUrl: null,
      bannerUrl: null,
      businessHours: null,
      timezone: "America/New_York",
      currency: "USD",
      locale: "en-US",
      status: "active",
      settings: null,
      deleted: false,
      tenantId: "tenant-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      tenant: {
        id: "tenant-1",
        slug: "joes-pizza",
        name: "Joe's Pizza",
        logoUrl: null,
        settings: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    it("should return merchant when tenantId matches", async () => {
      vi.mocked(merchantRepository.getByIdWithTenant).mockResolvedValue(mockPrismaData as never);

      const result = await merchantService.getMerchant("tenant-1", "merchant-1");

      expect(result?.id).toBe("merchant-1");
    });

    it("should return null when merchant not found", async () => {
      vi.mocked(merchantRepository.getByIdWithTenant).mockResolvedValue(null);

      const result = await merchantService.getMerchant("tenant-1", "non-existent");

      expect(result).toBeNull();
    });

    it("should return null when tenantId does not match (tenant isolation)", async () => {
      vi.mocked(merchantRepository.getByIdWithTenant).mockResolvedValue(mockPrismaData as never);

      const result = await merchantService.getMerchant("wrong-tenant", "merchant-1");

      expect(result).toBeNull();
    });
  });

  // ==================== getMerchantsByTenantId ====================
  describe("getMerchantsByTenantId()", () => {
    const mockMerchantData = {
      id: "merchant-1",
      slug: "joes-pizza-downtown",
      name: "Joe's Pizza - Downtown",
      description: null,
      address: null,
      city: null,
      state: null,
      zipCode: null,
      country: "US",
      phone: null,
      email: null,
      logoUrl: null,
      bannerUrl: null,
      businessHours: null,
      timezone: "America/New_York",
      currency: "USD",
      locale: "en-US",
      status: "active",
      settings: null,
      deleted: false,
      tenantId: "tenant-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      tenant: {
        id: "tenant-1",
        slug: "joes-pizza",
        name: "Joe's Pizza",
        logoUrl: null,
        settings: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    it("should return all merchants when no status filter", async () => {
      vi.mocked(merchantRepository.getByTenantIdWithTenant).mockResolvedValue(
        [mockMerchantData] as never
      );

      const result = await merchantService.getMerchantsByTenantId("tenant-1");

      expect(merchantRepository.getByTenantIdWithTenant).toHaveBeenCalledWith("tenant-1");
      expect(result).toHaveLength(1);
    });

    it("should return active merchants when status filter is 'active'", async () => {
      vi.mocked(merchantRepository.getActiveByTenantIdWithTenant).mockResolvedValue(
        [mockMerchantData] as never
      );

      const result = await merchantService.getMerchantsByTenantId(
        "tenant-1",
        { status: "active" }
      );

      expect(merchantRepository.getActiveByTenantIdWithTenant).toHaveBeenCalledWith("tenant-1");
      expect(result).toHaveLength(1);
    });
  });

  // ==================== createMerchant ====================
  describe("createMerchant()", () => {
    const mockTenant = {
      id: "tenant-1",
      slug: "joes-pizza",
      name: "Joe's Pizza",
    };

    const mockCreatedMerchant = {
      id: "new-merchant",
      slug: "new-location",
      name: "New Location",
    };

    const mockCreatedMerchantWithTenant = {
      id: "new-merchant",
            slug: "new-location",
      name: "New Location",
      description: null,
      address: null,
      city: null,
      state: null,
      zipCode: null,
      country: "US",
      phone: null,
      email: null,
      logoUrl: null,
      bannerUrl: null,
      businessHours: null,
      timezone: "America/New_York",
      currency: "USD",
      locale: "en-US",
      status: "active",
      settings: null,
      deleted: false,
      tenantId: "tenant-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      tenant: {
        id: "tenant-1",
        slug: "joes-pizza",
        name: "Joe's Pizza",
        logoUrl: null,
        settings: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    it("should create merchant successfully", async () => {
      vi.mocked(tenantRepository.getById).mockResolvedValue(mockTenant as never);
      vi.mocked(merchantRepository.isSlugAvailable).mockResolvedValue(true);
      vi.mocked(merchantRepository.create).mockResolvedValue(mockCreatedMerchant as never);
      vi.mocked(merchantRepository.getByIdWithTenant).mockResolvedValue(
        mockCreatedMerchantWithTenant as never
      );

      const result = await merchantService.createMerchant("tenant-1", {
        slug: "new-location",
        name: "New Location",
      });

      expect(result.id).toBe("new-merchant");
      expect(merchantRepository.create).toHaveBeenCalledWith(
        "tenant-1",
        expect.objectContaining({
          slug: "new-location",
          name: "New Location",
          country: "US",
          timezone: "America/New_York",
          currency: "USD",
          locale: "en-US",
        })
      );
    });

    it("should throw TENANT_NOT_FOUND when company does not exist", async () => {
      vi.mocked(tenantRepository.getById).mockResolvedValue(null);

      await expect(
        merchantService.createMerchant("non-existent", {
          slug: "new",
          name: "New",
        })
      ).rejects.toThrow(AppError);

      try {
        await merchantService.createMerchant("non-existent", {
          slug: "new",
          name: "New",
        });
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ErrorCodes.TENANT_NOT_FOUND);
        expect((error as AppError).statusCode).toBe(404);
      }
    });

    it("should throw MERCHANT_SLUG_TAKEN when slug is unavailable", async () => {
      vi.mocked(tenantRepository.getById).mockResolvedValue(mockTenant as never);
      vi.mocked(merchantRepository.isSlugAvailable).mockResolvedValue(false);

      await expect(
        merchantService.createMerchant("tenant-1", {
          slug: "taken-slug",
          name: "New",
        })
      ).rejects.toThrow(AppError);

      try {
        await merchantService.createMerchant("tenant-1", {
          slug: "taken-slug",
          name: "New",
        });
      } catch (error) {
        expect((error as AppError).code).toBe(ErrorCodes.MERCHANT_SLUG_TAKEN);
        expect((error as AppError).statusCode).toBe(409);
        expect((error as AppError).params).toEqual({ slug: "taken-slug" });
      }
    });

    it("should use default values for optional fields", async () => {
      vi.mocked(tenantRepository.getById).mockResolvedValue(mockTenant as never);
      vi.mocked(merchantRepository.isSlugAvailable).mockResolvedValue(true);
      vi.mocked(merchantRepository.create).mockResolvedValue(mockCreatedMerchant as never);
      vi.mocked(merchantRepository.getByIdWithTenant).mockResolvedValue(
        mockCreatedMerchantWithTenant as never
      );

      await merchantService.createMerchant("tenant-1", {
        slug: "new",
        name: "New",
      });

      expect(merchantRepository.create).toHaveBeenCalledWith(
        "tenant-1",
        expect.objectContaining({
          country: "US",
          timezone: "America/New_York",
          currency: "USD",
          locale: "en-US",
        })
      );
    });

    it("should pass explicit values for optional fields", async () => {
      vi.mocked(tenantRepository.getById).mockResolvedValue(mockTenant as never);
      vi.mocked(merchantRepository.isSlugAvailable).mockResolvedValue(true);
      vi.mocked(merchantRepository.create).mockResolvedValue(mockCreatedMerchant as never);
      vi.mocked(merchantRepository.getByIdWithTenant).mockResolvedValue(
        mockCreatedMerchantWithTenant as never
      );

      await merchantService.createMerchant("tenant-1", {
        slug: "new",
        name: "New",
        country: "CA",
        timezone: "America/Toronto",
        currency: "CAD",
        locale: "en-CA",
        address: "456 Oak St",
        businessHours: { mon: { open: "09:00", close: "17:00" } },
        settings: { acceptsPickup: true, acceptsDelivery: false },
      });

      expect(merchantRepository.create).toHaveBeenCalledWith(
        "tenant-1",
        expect.objectContaining({
          country: "CA",
          timezone: "America/Toronto",
          currency: "CAD",
          locale: "en-CA",
          address: "456 Oak St",
        })
      );
    });
  });

  // ==================== updateMerchant ====================
  describe("updateMerchant()", () => {
    const mockExistingPrisma = {
      id: "merchant-1",
            slug: "joes-pizza-downtown",
      name: "Joe's Pizza - Downtown",
      description: null,
      address: null,
      city: null,
      state: null,
      zipCode: null,
      country: "US",
      phone: null,
      email: null,
      logoUrl: null,
      bannerUrl: null,
      businessHours: null,
      timezone: "America/New_York",
      currency: "USD",
      locale: "en-US",
      status: "active",
      settings: { acceptsPickup: true },
      deleted: false,
      tenantId: "tenant-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      tenant: {
        id: "tenant-1",
        slug: "joes-pizza",
        name: "Joe's Pizza",
        logoUrl: null,
        settings: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    beforeEach(() => {
      // getMerchant calls getByIdWithTenant
      vi.mocked(merchantRepository.getByIdWithTenant).mockResolvedValue(
        mockExistingPrisma as never
      );
    });

    it("should update merchant successfully", async () => {
      vi.mocked(merchantRepository.update).mockResolvedValue({} as never);

      const result = await merchantService.updateMerchant("tenant-1", "merchant-1", {
        name: "Updated Name",
        address: "456 New St",
      });

      expect(merchantRepository.update).toHaveBeenCalledWith(
        "merchant-1",
        expect.objectContaining({
          name: "Updated Name",
          address: "456 New St",
        })
      );
      expect(result).toBeDefined();
    });

    it("should throw MERCHANT_NOT_FOUND when merchant does not exist", async () => {
      vi.mocked(merchantRepository.getByIdWithTenant).mockResolvedValue(null);

      await expect(
        merchantService.updateMerchant("tenant-1", "non-existent", { name: "Test" })
      ).rejects.toThrow(AppError);

      try {
        await merchantService.updateMerchant("tenant-1", "non-existent", { name: "Test" });
      } catch (error) {
        expect((error as AppError).code).toBe(ErrorCodes.MERCHANT_NOT_FOUND);
        expect((error as AppError).statusCode).toBe(404);
      }
    });

    it("should check slug availability when slug changes", async () => {
      vi.mocked(merchantRepository.isSlugAvailable).mockResolvedValue(true);
      vi.mocked(merchantRepository.update).mockResolvedValue({} as never);

      await merchantService.updateMerchant("tenant-1", "merchant-1", {
        slug: "new-slug",
      });

      expect(merchantRepository.isSlugAvailable).toHaveBeenCalledWith("new-slug", "merchant-1");
    });

    it("should throw MERCHANT_SLUG_TAKEN when new slug is taken", async () => {
      vi.mocked(merchantRepository.isSlugAvailable).mockResolvedValue(false);

      await expect(
        merchantService.updateMerchant("tenant-1", "merchant-1", { slug: "taken-slug" })
      ).rejects.toThrow(AppError);

      try {
        await merchantService.updateMerchant("tenant-1", "merchant-1", { slug: "taken-slug" });
      } catch (error) {
        expect((error as AppError).code).toBe(ErrorCodes.MERCHANT_SLUG_TAKEN);
      }
    });

    it("should not check slug availability when slug is unchanged", async () => {
      vi.mocked(merchantRepository.update).mockResolvedValue({} as never);

      await merchantService.updateMerchant("tenant-1", "merchant-1", {
        slug: "joes-pizza-downtown", // same as existing
      });

      expect(merchantRepository.isSlugAvailable).not.toHaveBeenCalled();
    });

    it("should merge settings with existing settings", async () => {
      vi.mocked(merchantRepository.update).mockResolvedValue({} as never);

      await merchantService.updateMerchant("tenant-1", "merchant-1", {
        settings: { acceptsDelivery: true },
      });

      expect(merchantRepository.update).toHaveBeenCalledWith(
        "merchant-1",
        expect.objectContaining({
          settings: { acceptsPickup: true, acceptsDelivery: true },
        })
      );
    });

    it("should handle all update fields", async () => {
      vi.mocked(merchantRepository.update).mockResolvedValue({} as never);

      await merchantService.updateMerchant("tenant-1", "merchant-1", {
        name: "New Name",
        description: "New description",
        address: "New address",
        city: "New city",
        state: "CA",
        zipCode: "90001",
        country: "US",
        phone: "555-1234",
        email: "new@test.com",
        logoUrl: "https://logo.png",
        bannerUrl: "https://banner.png",
        businessHours: { mon: { open: "08:00", close: "20:00" } },
        timezone: "America/Los_Angeles",
        currency: "USD",
        locale: "en-US",
        status: "inactive",
      });

      expect(merchantRepository.update).toHaveBeenCalledWith(
        "merchant-1",
        expect.objectContaining({
          name: "New Name",
          description: "New description",
          address: "New address",
          city: "New city",
          state: "CA",
          zipCode: "90001",
          country: "US",
          phone: "555-1234",
          email: "new@test.com",
          logoUrl: "https://logo.png",
          bannerUrl: "https://banner.png",
          timezone: "America/Los_Angeles",
          currency: "USD",
          locale: "en-US",
          status: "inactive",
        })
      );
    });

    it("should only include provided fields in update data", async () => {
      vi.mocked(merchantRepository.update).mockResolvedValue({} as never);

      await merchantService.updateMerchant("tenant-1", "merchant-1", {
        name: "Only Name",
      });

      const updateCall = vi.mocked(merchantRepository.update).mock.calls[0];
      const updateData = updateCall[1];
      expect(updateData).toEqual({ name: "Only Name" });
    });
  });

  // ==================== updateSettings ====================
  describe("updateSettings()", () => {
    const mockPrismaData = {
      id: "merchant-1",
            slug: "joes-pizza-downtown",
      name: "Joe's Pizza - Downtown",
      description: null,
      address: null,
      city: null,
      state: null,
      zipCode: null,
      country: "US",
      phone: null,
      email: null,
      logoUrl: null,
      bannerUrl: null,
      businessHours: null,
      timezone: "America/New_York",
      currency: "USD",
      locale: "en-US",
      status: "active",
      settings: null,
      deleted: false,
      tenantId: "tenant-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      tenant: {
        id: "tenant-1",
        slug: "joes-pizza",
        name: "Joe's Pizza",
        logoUrl: null,
        settings: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    it("should update settings successfully", async () => {
      vi.mocked(merchantRepository.getByIdWithTenant).mockResolvedValue(mockPrismaData as never);
      vi.mocked(merchantRepository.updateSettings).mockResolvedValue(mockPrismaData as never);

      const settings = { acceptsPickup: true, estimatedPrepTime: 30 };
      const result = await merchantService.updateSettings("tenant-1", "merchant-1", settings);

      expect(merchantRepository.updateSettings).toHaveBeenCalledWith("merchant-1", settings);
      expect(result).toBeDefined();
    });

    it("should throw MERCHANT_NOT_FOUND when merchant does not exist", async () => {
      vi.mocked(merchantRepository.getByIdWithTenant).mockResolvedValue(null);

      await expect(
        merchantService.updateSettings("tenant-1", "non-existent", { acceptsPickup: true })
      ).rejects.toThrow(AppError);
    });

    it("should throw when tenantId does not match", async () => {
      vi.mocked(merchantRepository.getByIdWithTenant).mockResolvedValue(mockPrismaData as never);

      await expect(
        merchantService.updateSettings("wrong-tenant", "merchant-1", { acceptsPickup: true })
      ).rejects.toThrow(AppError);
    });
  });

  // ==================== deleteMerchant ====================
  describe("deleteMerchant()", () => {
    const mockPrismaData = {
      id: "merchant-1",
            slug: "joes-pizza-downtown",
      name: "Joe's Pizza - Downtown",
      description: null,
      address: null,
      city: null,
      state: null,
      zipCode: null,
      country: "US",
      phone: null,
      email: null,
      logoUrl: null,
      bannerUrl: null,
      businessHours: null,
      timezone: "America/New_York",
      currency: "USD",
      locale: "en-US",
      status: "active",
      settings: null,
      deleted: false,
      tenantId: "tenant-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      tenant: {
        id: "tenant-1",
        slug: "joes-pizza",
        name: "Joe's Pizza",
        logoUrl: null,
        settings: null,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    it("should delete merchant successfully", async () => {
      vi.mocked(merchantRepository.getByIdWithTenant).mockResolvedValue(mockPrismaData as never);
      vi.mocked(merchantRepository.delete).mockResolvedValue({} as never);

      await merchantService.deleteMerchant("tenant-1", "merchant-1");

      expect(merchantRepository.delete).toHaveBeenCalledWith("merchant-1");
    });

    it("should throw MERCHANT_NOT_FOUND when merchant does not exist", async () => {
      vi.mocked(merchantRepository.getByIdWithTenant).mockResolvedValue(null);

      await expect(
        merchantService.deleteMerchant("tenant-1", "non-existent")
      ).rejects.toThrow(AppError);
    });

    it("should throw when tenantId does not match", async () => {
      vi.mocked(merchantRepository.getByIdWithTenant).mockResolvedValue(mockPrismaData as never);

      await expect(
        merchantService.deleteMerchant("wrong-tenant", "merchant-1")
      ).rejects.toThrow(AppError);
    });
  });

  // ==================== isSlugAvailable ====================
  describe("isSlugAvailable()", () => {
    it("should delegate to repository", async () => {
      vi.mocked(merchantRepository.isSlugAvailable).mockResolvedValue(true);

      const result = await merchantService.isSlugAvailable("new-slug");

      expect(merchantRepository.isSlugAvailable).toHaveBeenCalledWith("new-slug", undefined);
      expect(result).toBe(true);
    });

    it("should pass excludeMerchantId to repository", async () => {
      vi.mocked(merchantRepository.isSlugAvailable).mockResolvedValue(true);

      const result = await merchantService.isSlugAvailable("my-slug", "merchant-1");

      expect(merchantRepository.isSlugAvailable).toHaveBeenCalledWith("my-slug", "merchant-1");
      expect(result).toBe(true);
    });
  });

  // ==================== mapper branch coverage (toTenantWithMerchants null branches) ====================
  describe("mapper null-coalescing branches", () => {
    it("should map null company description/logoUrl to undefined via toTenantWithMerchants", async () => {
      const companyWithNullFields = {
        ...mockTenantWithMerchants,
        description: null,
        logoUrl: null,
        merchants: [
          {
            ...mockTenantWithMerchants.merchants[0],
            description: null,
            address: null,
            city: null,
            state: null,
            zipCode: null,
            phone: null,
            email: null,
            logoUrl: null,
            bannerUrl: null,
          },
        ],
      };
      vi.mocked(tenantRepository.getBySlugWithMerchants).mockResolvedValue(
        companyWithNullFields as never
      );

      const result = await merchantService.getTenantBySlug("joes-pizza");

      expect(result).not.toBeNull();
      expect(result?.description).toBeUndefined();
      expect(result?.logoUrl).toBeUndefined();
      // Merchant within company should also have null fields mapped to undefined
      expect(result?.merchants[0].description).toBeUndefined();
      expect(result?.merchants[0].address).toBeUndefined();
      expect(result?.merchants[0].city).toBeUndefined();
      expect(result?.merchants[0].state).toBeUndefined();
      expect(result?.merchants[0].zipCode).toBeUndefined();
      expect(result?.merchants[0].phone).toBeUndefined();
      expect(result?.merchants[0].email).toBeUndefined();
      expect(result?.merchants[0].logoUrl).toBeUndefined();
      expect(result?.merchants[0].bannerUrl).toBeUndefined();
      expect(result?.merchants[0].tenant.logoUrl).toBeUndefined();
    });
  });

  // ==================== updateMerchant settings merge with null existing settings ====================
  describe("updateMerchant() settings merge with null existing settings", () => {
    it("should use empty object fallback when existing settings is null", async () => {
      const mockWithNullSettings = {
        id: "merchant-1",
                slug: "joes-pizza-downtown",
        name: "Joe's Pizza - Downtown",
        description: null,
        address: null,
        city: null,
        state: null,
        zipCode: null,
        country: "US",
        phone: null,
        email: null,
        logoUrl: null,
        bannerUrl: null,
        businessHours: null,
        timezone: "America/New_York",
        currency: "USD",
        locale: "en-US",
        status: "active",
        settings: null,
        deleted: false,
        tenantId: "tenant-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        tenant: {
          id: "tenant-1",
          slug: "joes-pizza",
          name: "Joe's Pizza",
          logoUrl: null,
          settings: null,
            deleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };
      vi.mocked(merchantRepository.getByIdWithTenant).mockResolvedValue(
        mockWithNullSettings as never
      );
      vi.mocked(merchantRepository.update).mockResolvedValue({} as never);

      await merchantService.updateMerchant("tenant-1", "merchant-1", {
        settings: { acceptsDelivery: true },
      });

      expect(merchantRepository.update).toHaveBeenCalledWith(
        "merchant-1",
        expect.objectContaining({
          settings: { acceptsDelivery: true },
        })
      );
    });
  });

  // ==================== isOpen ====================
  describe("isOpen()", () => {
    it("should delegate to repository", async () => {
      vi.mocked(merchantRepository.isOpen).mockResolvedValue(true);

      const result = await merchantService.isOpen("merchant-1");

      expect(merchantRepository.isOpen).toHaveBeenCalledWith("merchant-1");
      expect(result).toBe(true);
    });

    it("should return false when repository returns false", async () => {
      vi.mocked(merchantRepository.isOpen).mockResolvedValue(false);

      const result = await merchantService.isOpen("merchant-1");

      expect(result).toBe(false);
    });
  });

  describe("lookupByAiPhone()", () => {
    it("delegates to repository.getByAiPhone", async () => {
      const merchant = { id: "m1", tenantId: "t1", name: "X" };
      vi.mocked(merchantRepository.getByAiPhone).mockResolvedValue(merchant as never);

      const result = await merchantService.lookupByAiPhone("+14155551234");

      expect(merchantRepository.getByAiPhone).toHaveBeenCalledWith("+14155551234");
      expect(result).toEqual(merchant);
    });

    it("returns null when no merchant found", async () => {
      vi.mocked(merchantRepository.getByAiPhone).mockResolvedValue(null);

      const result = await merchantService.lookupByAiPhone("+10000000000");

      expect(result).toBeNull();
    });
  });
});
