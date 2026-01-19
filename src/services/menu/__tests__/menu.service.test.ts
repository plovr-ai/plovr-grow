import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuService } from "../menu.service";
import { Prisma } from "@prisma/client";

// Mock repositories
vi.mock("@/repositories/menu.repository", () => ({
  menuRepository: {
    getCategoriesWithItemsByCompany: vi.fn(),
    getItemById: vi.fn(),
    getItemsByIdsByCompany: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
  },
}));

vi.mock("@/repositories/merchant.repository", () => ({
  merchantRepository: {
    getById: vi.fn(),
  },
}));

// Import mocked modules
import { menuRepository } from "@/repositories/menu.repository";
import { merchantRepository } from "@/repositories/merchant.repository";

describe("MenuService", () => {
  let menuService: MenuService;

  // Mock data
  const mockMerchant = {
    id: "merchant-1",
    companyId: "company-1",
    name: "Test Merchant",
    slug: "test-merchant",
    logoUrl: "https://example.com/logo.png",
  };

  const mockCategories = [
    {
      id: "cat-pizza",
      tenantId: "tenant-1",
      companyId: "company-1",
      name: "Pizza",
      description: "Our famous pizzas",
      imageUrl: null,
      sortOrder: 1,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      menuItems: [
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
          options: null,
          nutrition: null,
          tags: ["popular"],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    },
    {
      id: "cat-sides",
      tenantId: "tenant-1",
      companyId: "company-1",
      name: "Sides",
      description: "Perfect additions",
      imageUrl: null,
      sortOrder: 2,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      menuItems: [
        {
          id: "item-garlic-knots",
          tenantId: "tenant-1",
          companyId: "company-1",
          categoryId: "cat-sides",
          name: "Garlic Knots",
          description: "Fresh baked knots with garlic butter",
          price: new Prisma.Decimal(5.99),
          imageUrl: null,
          sortOrder: 1,
          status: "active",
          options: null,
          nutrition: null,
          tags: ["vegetarian"],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    },
  ];

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
      options: null,
      nutrition: null,
      tags: ["popular"],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    menuService = new MenuService();
  });

  describe("getMenu()", () => {
    beforeEach(() => {
      vi.mocked(merchantRepository.getById).mockResolvedValue(mockMerchant as never);
      vi.mocked(menuRepository.getCategoriesWithItemsByCompany).mockResolvedValue(
        mockCategories as never
      );
    });

    it("should return menu with categories and items", async () => {
      const result = await menuService.getMenu("tenant-1", "merchant-1");

      expect(result.categories).toHaveLength(2);
      expect(result.categories[0].name).toBe("Pizza");
      expect(result.categories[0].menuItems).toHaveLength(2);
      expect(result.categories[1].name).toBe("Sides");
      expect(result.categories[1].menuItems).toHaveLength(1);
    });

    it("should return merchant info in response", async () => {
      const result = await menuService.getMenu("tenant-1", "merchant-1");

      expect(result.merchantId).toBe("merchant-1");
      expect(result.merchantName).toBe("Test Merchant");
      expect(result.merchantLogo).toBe("https://example.com/logo.png");
    });

    it("should call merchantRepository.getById with correct merchantId", async () => {
      await menuService.getMenu("tenant-1", "merchant-1");

      expect(merchantRepository.getById).toHaveBeenCalledWith("merchant-1");
    });

    it("should call menuRepository.getCategoriesWithItemsByCompany with correct params", async () => {
      await menuService.getMenu("tenant-1", "merchant-1");

      expect(menuRepository.getCategoriesWithItemsByCompany).toHaveBeenCalledWith(
        "tenant-1",
        "company-1"
      );
    });

    it("should throw error when merchant not found", async () => {
      vi.mocked(merchantRepository.getById).mockResolvedValue(null as never);

      await expect(menuService.getMenu("tenant-1", "non-existent")).rejects.toThrow(
        "Merchant not found"
      );
    });

    it("should return null merchantLogo when merchant has no logoUrl", async () => {
      vi.mocked(merchantRepository.getById).mockResolvedValue({
        ...mockMerchant,
        logoUrl: null,
      } as never);

      const result = await menuService.getMenu("tenant-1", "merchant-1");

      expect(result.merchantLogo).toBeNull();
    });

    it("should return empty categories when no menu data exists", async () => {
      vi.mocked(menuRepository.getCategoriesWithItemsByCompany).mockResolvedValue([] as never);

      const result = await menuService.getMenu("tenant-1", "merchant-1");

      expect(result.categories).toHaveLength(0);
    });
  });

  describe("getMenuItemsByIds()", () => {
    beforeEach(() => {
      vi.mocked(merchantRepository.getById).mockResolvedValue(mockMerchant as never);
      vi.mocked(menuRepository.getItemsByIdsByCompany).mockResolvedValue(mockMenuItems as never);
    });

    it("should return menu items for given IDs", async () => {
      const itemIds = ["item-cheese-pizza", "item-pepperoni-pizza"];

      const result = await menuService.getMenuItemsByIds("tenant-1", "merchant-1", itemIds);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("item-cheese-pizza");
      expect(result[1].id).toBe("item-pepperoni-pizza");
    });

    it("should call merchantRepository.getById with correct merchantId", async () => {
      await menuService.getMenuItemsByIds("tenant-1", "merchant-1", ["item-1"]);

      expect(merchantRepository.getById).toHaveBeenCalledWith("merchant-1");
    });

    it("should call menuRepository.getItemsByIdsByCompany with correct params", async () => {
      const itemIds = ["item-cheese-pizza", "item-pepperoni-pizza"];

      await menuService.getMenuItemsByIds("tenant-1", "merchant-1", itemIds);

      expect(menuRepository.getItemsByIdsByCompany).toHaveBeenCalledWith(
        "tenant-1",
        "company-1",
        itemIds
      );
    });

    it("should throw error when merchant not found", async () => {
      vi.mocked(merchantRepository.getById).mockResolvedValue(null as never);

      await expect(
        menuService.getMenuItemsByIds("tenant-1", "non-existent", ["item-1"])
      ).rejects.toThrow("Merchant not found");
    });

    it("should return empty array when no items match", async () => {
      vi.mocked(menuRepository.getItemsByIdsByCompany).mockResolvedValue([] as never);

      const result = await menuService.getMenuItemsByIds("tenant-1", "merchant-1", [
        "non-existent-item",
      ]);

      expect(result).toHaveLength(0);
    });

    it("should return partial results when some items exist", async () => {
      vi.mocked(menuRepository.getItemsByIdsByCompany).mockResolvedValue([
        mockMenuItems[0],
      ] as never);

      const result = await menuService.getMenuItemsByIds("tenant-1", "merchant-1", [
        "item-cheese-pizza",
        "non-existent-item",
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("item-cheese-pizza");
    });
  });

  describe("getMenuItem()", () => {
    const mockMenuItem = {
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
      category: {
        id: "cat-pizza",
        name: "Pizza",
      },
    };

    beforeEach(() => {
      vi.mocked(menuRepository.getItemById).mockResolvedValue(mockMenuItem as never);
    });

    it("should return menu item with category", async () => {
      const result = await menuService.getMenuItem("tenant-1", "item-cheese-pizza");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("item-cheese-pizza");
      expect(result?.name).toBe("Classic Cheese Pizza");
      expect(result?.category.name).toBe("Pizza");
    });

    it("should call menuRepository.getItemById with correct params", async () => {
      await menuService.getMenuItem("tenant-1", "item-cheese-pizza");

      expect(menuRepository.getItemById).toHaveBeenCalledWith("tenant-1", "item-cheese-pizza");
    });

    it("should return null for non-existent item", async () => {
      vi.mocked(menuRepository.getItemById).mockResolvedValue(null as never);

      const result = await menuService.getMenuItem("tenant-1", "non-existent");

      expect(result).toBeNull();
    });
  });
});
