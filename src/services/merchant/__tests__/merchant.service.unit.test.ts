import { describe, it, expect, vi, beforeEach } from "vitest";
import { MerchantService } from "../merchant.service";
import { Prisma } from "@prisma/client";

// Mock repositories
vi.mock("@/repositories/merchant.repository", () => ({
  merchantRepository: {
    getBySlugWithCompany: vi.fn(),
    getByIdWithCompany: vi.fn(),
    getByCompanyIdWithCompany: vi.fn(),
    getActiveByCompanyIdWithCompany: vi.fn(),
    isSlugAvailable: vi.fn(),
    getTaxRate: vi.fn(),
    isOpen: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateSettings: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/repositories/company.repository", () => ({
  companyRepository: {
    getById: vi.fn(),
    getBySlugWithMerchants: vi.fn(),
  },
}));

vi.mock("@/services/menu", () => ({
  menuService: {
    getMenuItemsByCompanyId: vi.fn(),
  },
}));

// Import mocked modules
import { companyRepository } from "@/repositories/company.repository";
import { menuService } from "@/services/menu";

describe("MerchantService (unit tests)", () => {
  let merchantService: MerchantService;

  // Mock data
  const mockCompanyWithMerchants = {
    id: "company-1",
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
    tenant: {
      id: "tenant-1",
      name: "Joe's Pizza Tenant",
    },
    merchants: [
      {
        id: "merchant-1",
        companyId: "company-1",
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
        taxRate: new Prisma.Decimal(0.08875),
        status: "active",
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        company: {
          id: "company-1",
          slug: "joes-pizza",
          tenantId: "tenant-1",
          name: "Joe's Pizza",
          logoUrl: "https://example.com/logo.png",
          settings: {},
          tenant: {
            id: "tenant-1",
            name: "Joe's Pizza Tenant",
          },
        },
      },
    ],
  };

  const mockMenuItems = [
    {
      id: "item-cheese-pizza",
      tenantId: "tenant-1",
      companyId: "company-1",
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
      companyId: "company-1",
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
    merchantService = new MerchantService();
  });

  describe("getCompanyWebsiteData()", () => {
    beforeEach(() => {
      vi.mocked(companyRepository.getBySlugWithMerchants).mockResolvedValue(
        mockCompanyWithMerchants as never
      );
      vi.mocked(menuService.getMenuItemsByCompanyId).mockResolvedValue(
        mockMenuItems as never
      );
    });

    it("should return website data with company info", async () => {
      const result = await merchantService.getCompanyWebsiteData("joes-pizza");

      expect(result).not.toBeNull();
      expect(result?.name).toBe("Joe's Pizza");
      expect(result?.tagline).toBe("Best pizza in NYC");
      expect(result?.logo).toBe("https://example.com/logo.png");
      expect(result?.heroImage).toBe("https://example.com/hero.jpg");
    });

    it("should fetch featured items from menu database", async () => {
      const result = await merchantService.getCompanyWebsiteData("joes-pizza");

      expect(menuService.getMenuItemsByCompanyId).toHaveBeenCalledWith(
        "tenant-1",
        "company-1",
        ["item-cheese-pizza", "item-pepperoni-pizza"]
      );
      expect(result?.featuredItems).toHaveLength(2);
    });

    it("should map menu items to FeaturedItem format", async () => {
      const result = await merchantService.getCompanyWebsiteData("joes-pizza");

      const featuredItems = result?.featuredItems;
      expect(featuredItems?.[0]).toEqual({
        id: "item-cheese-pizza",
        name: "Classic Cheese Pizza",
        description: "Fresh mozzarella and tomato sauce",
        price: 18.99,
        image: "https://example.com/pizza.jpg",
        category: undefined,
        menuItemId: "item-cheese-pizza",
        hasModifiers: false,
      });
    });

    it("should set hasModifiers to true when item has options", async () => {
      const result = await merchantService.getCompanyWebsiteData("joes-pizza");

      const pepperoniItem = result?.featuredItems?.find(
        (item) => item.id === "item-pepperoni-pizza"
      );
      expect(pepperoniItem?.hasModifiers).toBe(true);
    });

    it("should return empty featuredItems when no featuredItemIds configured", async () => {
      vi.mocked(companyRepository.getBySlugWithMerchants).mockResolvedValue({
        ...mockCompanyWithMerchants,
        settings: {
          ...mockCompanyWithMerchants.settings,
          website: {
            ...mockCompanyWithMerchants.settings.website,
            featuredItemIds: undefined,
          },
        },
      } as never);

      const result = await merchantService.getCompanyWebsiteData("joes-pizza");

      expect(menuService.getMenuItemsByCompanyId).not.toHaveBeenCalled();
      expect(result?.featuredItems).toEqual([]);
    });

    it("should return empty featuredItems when featuredItemIds is empty array", async () => {
      vi.mocked(companyRepository.getBySlugWithMerchants).mockResolvedValue({
        ...mockCompanyWithMerchants,
        settings: {
          ...mockCompanyWithMerchants.settings,
          website: {
            ...mockCompanyWithMerchants.settings.website,
            featuredItemIds: [],
          },
        },
      } as never);

      const result = await merchantService.getCompanyWebsiteData("joes-pizza");

      expect(menuService.getMenuItemsByCompanyId).not.toHaveBeenCalled();
      expect(result?.featuredItems).toEqual([]);
    });

    it("should handle missing imageUrl gracefully", async () => {
      vi.mocked(menuService.getMenuItemsByCompanyId).mockResolvedValue([
        { ...mockMenuItems[0], imageUrl: null },
      ] as never);

      const result = await merchantService.getCompanyWebsiteData("joes-pizza");

      expect(result?.featuredItems?.[0].image).toBe("");
    });

    it("should handle missing description gracefully", async () => {
      vi.mocked(menuService.getMenuItemsByCompanyId).mockResolvedValue([
        { ...mockMenuItems[0], description: null },
      ] as never);

      const result = await merchantService.getCompanyWebsiteData("joes-pizza");

      expect(result?.featuredItems?.[0].description).toBe("");
    });

    it("should return reviews from company settings", async () => {
      const result = await merchantService.getCompanyWebsiteData("joes-pizza");

      expect(result?.reviews).toHaveLength(1);
      expect(result?.reviews?.[0].customerName).toBe("John D.");
    });

    it("should return socialLinks from company settings", async () => {
      const result = await merchantService.getCompanyWebsiteData("joes-pizza");

      expect(result?.socialLinks).toHaveLength(1);
      expect(result?.socialLinks[0].platform).toBe("facebook");
    });

    it("should return null for non-existent company", async () => {
      vi.mocked(companyRepository.getBySlugWithMerchants).mockResolvedValue(
        null as never
      );

      const result = await merchantService.getCompanyWebsiteData("non-existent");

      expect(result).toBeNull();
    });

    it("should use default currency and locale when not configured", async () => {
      vi.mocked(companyRepository.getBySlugWithMerchants).mockResolvedValue({
        ...mockCompanyWithMerchants,
        settings: null,
      } as never);

      const result = await merchantService.getCompanyWebsiteData("joes-pizza");

      expect(result?.currency).toBe("USD");
      expect(result?.locale).toBe("en-US");
    });
  });
});
