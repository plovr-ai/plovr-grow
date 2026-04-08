import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuService } from "../menu.service";
import { Prisma } from "@prisma/client";

// Mock repositories
vi.mock("@/repositories/menu.repository", () => ({
  menuRepository: {
    getCategoriesWithItemsByCompany: vi.fn(),
    getCategoriesWithItemsByMenu: vi.fn(),
    getItemById: vi.fn(),
    getItemsByIdsByCompany: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
  },
}));

vi.mock("@/repositories/menu-entity.repository", () => ({
  menuEntityRepository: {
    getMenusByCompany: vi.fn(),
    getMenusByCompanyForDashboard: vi.fn(),
    createMenu: vi.fn(),
    updateMenu: vi.fn(),
    deleteMenu: vi.fn(),
    countMenusByCompany: vi.fn(),
    updateMenuSortOrders: vi.fn(),
  },
}));

vi.mock("@/repositories/merchant.repository", () => ({
  merchantRepository: {
    getById: vi.fn(),
  },
}));

vi.mock("@/repositories/tax-config.repository", () => ({
  taxConfigRepository: {
    getMenuItemsTaxConfigIds: vi.fn(),
    getTaxConfigsByIds: vi.fn(),
    getMerchantTaxRateMap: vi.fn(),
  },
}));

vi.mock("@/repositories/menu-category-item.repository", () => ({
  menuCategoryItemRepository: {
    getNextSortOrder: vi.fn(),
    linkItemToCategory: vi.fn(),
    unlinkItemFromCategory: vi.fn(),
    setItemCategories: vi.fn(),
    getItemsCategoryIds: vi.fn(),
    getItemsNotInCategory: vi.fn(),
    countItemCategories: vi.fn(),
  },
}));

vi.mock("@/repositories/featured-item.repository", () => ({
  featuredItemRepository: {
    getByCompanyId: vi.fn(),
    setFeaturedItems: vi.fn(),
    addFeaturedItem: vi.fn(),
    removeFeaturedItem: vi.fn(),
    reorderFeaturedItems: vi.fn(),
  },
}));

// Import mocked modules
import { menuRepository } from "@/repositories/menu.repository";
import { menuEntityRepository } from "@/repositories/menu-entity.repository";
import { merchantRepository } from "@/repositories/merchant.repository";
import { taxConfigRepository } from "@/repositories/tax-config.repository";
import { featuredItemRepository } from "@/repositories/featured-item.repository";

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

  // Mock menus
  const mockMenus = [
    {
      id: "menu-1",
      tenantId: "tenant-1",
      companyId: "company-1",
      name: "Main Menu",
      description: null,
      sortOrder: 0,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  // Mock categories with junction table structure (categoryItems)
  const mockCategoriesWithJunction = [
    {
      id: "cat-pizza",
      tenantId: "tenant-1",
      companyId: "company-1",
      menuId: "menu-1",
      name: "Pizza",
      description: "Our famous pizzas",
      imageUrl: null,
      sortOrder: 1,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      categoryItems: [
        {
          sortOrder: 1,
          menuItem: {
            id: "item-cheese-pizza",
            tenantId: "tenant-1",
            companyId: "company-1",
            name: "Classic Cheese Pizza",
            description: "Fresh mozzarella and tomato sauce",
            price: new Prisma.Decimal(18.99),
            imageUrl: "https://example.com/pizza.jpg",
            status: "active",
            options: null,
            nutrition: null,
            tags: ["vegetarian"],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        {
          sortOrder: 2,
          menuItem: {
            id: "item-pepperoni-pizza",
            tenantId: "tenant-1",
            companyId: "company-1",
            name: "Pepperoni Pizza",
            description: "Classic pepperoni with mozzarella",
            price: new Prisma.Decimal(21.99),
            imageUrl: "https://example.com/pepperoni.jpg",
            status: "active",
            options: null,
            nutrition: null,
            tags: ["popular"],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ],
    },
    {
      id: "cat-sides",
      tenantId: "tenant-1",
      companyId: "company-1",
      menuId: "menu-1",
      name: "Sides",
      description: "Perfect additions",
      imageUrl: null,
      sortOrder: 2,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      categoryItems: [
        {
          sortOrder: 1,
          menuItem: {
            id: "item-garlic-knots",
            tenantId: "tenant-1",
            companyId: "company-1",
            name: "Garlic Knots",
            description: "Fresh baked knots with garlic butter",
            price: new Prisma.Decimal(5.99),
            imageUrl: null,
            status: "active",
            options: null,
            nutrition: null,
            tags: ["vegetarian"],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
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
    // Mock tax data
    const mockItemTaxMap = new Map([
      ["item-cheese-pizza", ["tax-standard"]],
      ["item-pepperoni-pizza", ["tax-standard", "tax-alcohol"]],
      ["item-garlic-knots", ["tax-standard"]],
    ]);

    const mockTaxConfigs = [
      {
        id: "tax-standard",
        tenantId: "tenant-1",
        companyId: "company-1",
        name: "Standard Tax",
        description: null,
        roundingMethod: "half_up",
        isDefault: true,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "tax-alcohol",
        tenantId: "tenant-1",
        companyId: "company-1",
        name: "Alcohol Tax",
        description: null,
        roundingMethod: "half_up",
        isDefault: false,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const mockMerchantTaxRateMap = new Map([
      ["tax-standard", 0.0825],
      ["tax-alcohol", 0.05],
    ]);

    beforeEach(() => {
      vi.mocked(merchantRepository.getById).mockResolvedValue(mockMerchant as never);
      vi.mocked(menuEntityRepository.getMenusByCompany).mockResolvedValue(mockMenus as never);
      vi.mocked(menuRepository.getCategoriesWithItemsByMenu).mockResolvedValue(
        mockCategoriesWithJunction as never
      );
      vi.mocked(featuredItemRepository.getByCompanyId).mockResolvedValue([] as never);
      // Default tax mocks
      vi.mocked(taxConfigRepository.getMenuItemsTaxConfigIds).mockResolvedValue(mockItemTaxMap);
      vi.mocked(taxConfigRepository.getTaxConfigsByIds).mockResolvedValue(mockTaxConfigs as never);
      vi.mocked(taxConfigRepository.getMerchantTaxRateMap).mockResolvedValue(mockMerchantTaxRateMap);
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

    it("should call menuRepository.getCategoriesWithItemsByMenu with correct params", async () => {
      await menuService.getMenu("tenant-1", "merchant-1");

      expect(menuRepository.getCategoriesWithItemsByMenu).toHaveBeenCalledWith(
        "tenant-1",
        "menu-1"
      );
    });

    it("should throw error when merchant not found", async () => {
      vi.mocked(merchantRepository.getById).mockResolvedValue(null as never);

      await expect(menuService.getMenu("tenant-1", "non-existent")).rejects.toThrow(
        "MERCHANT_NOT_FOUND"
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
      vi.mocked(menuRepository.getCategoriesWithItemsByMenu).mockResolvedValue([] as never);

      const result = await menuService.getMenu("tenant-1", "merchant-1");

      expect(result.categories).toHaveLength(0);
    });

    // Tax integration tests
    it("should enrich menu items with taxes array", async () => {
      const result = await menuService.getMenu("tenant-1", "merchant-1");

      // Check that items have taxes
      const cheesePizza = result.categories[0].menuItems.find(
        (item) => item.id === "item-cheese-pizza"
      );
      expect(cheesePizza?.taxes).toBeDefined();
      expect(cheesePizza?.taxes).toHaveLength(1);
      expect(cheesePizza?.taxes?.[0]).toEqual({
        taxConfigId: "tax-standard",
        name: "Standard Tax",
        rate: 0.0825,
        roundingMethod: "half_up",
      });
    });

    it("should support multiple taxes per item", async () => {
      const result = await menuService.getMenu("tenant-1", "merchant-1");

      // Pepperoni pizza has both standard and alcohol tax
      const pepperoniPizza = result.categories[0].menuItems.find(
        (item) => item.id === "item-pepperoni-pizza"
      );
      expect(pepperoniPizza?.taxes).toHaveLength(2);
      expect(pepperoniPizza?.taxes?.[0]).toEqual({
        taxConfigId: "tax-standard",
        name: "Standard Tax",
        rate: 0.0825,
        roundingMethod: "half_up",
      });
      expect(pepperoniPizza?.taxes?.[1]).toEqual({
        taxConfigId: "tax-alcohol",
        name: "Alcohol Tax",
        rate: 0.05,
        roundingMethod: "half_up",
      });
    });

    it("should use merchant-specific tax rates", async () => {
      // Different merchant with different rates
      const differentRateMap = new Map([
        ["tax-standard", 0.09], // 9% instead of 8.25%
        ["tax-alcohol", 0.1], // 10% instead of 5%
      ]);
      vi.mocked(taxConfigRepository.getMerchantTaxRateMap).mockResolvedValue(differentRateMap);

      const result = await menuService.getMenu("tenant-1", "merchant-1");

      const cheesePizza = result.categories[0].menuItems.find(
        (item) => item.id === "item-cheese-pizza"
      );
      expect(cheesePizza?.taxes?.[0].rate).toBe(0.09);
    });

    it("should return empty taxes array for items without tax config", async () => {
      // Item without tax config
      const emptyTaxMap = new Map<string, string[]>();
      vi.mocked(taxConfigRepository.getMenuItemsTaxConfigIds).mockResolvedValue(emptyTaxMap);

      const result = await menuService.getMenu("tenant-1", "merchant-1");

      const cheesePizza = result.categories[0].menuItems.find(
        (item) => item.id === "item-cheese-pizza"
      );
      expect(cheesePizza?.taxes).toEqual([]);
    });

    it("should call tax repository methods with correct parameters", async () => {
      await menuService.getMenu("tenant-1", "merchant-1");

      // Should fetch tax config IDs for all menu items
      expect(taxConfigRepository.getMenuItemsTaxConfigIds).toHaveBeenCalledWith([
        "item-cheese-pizza",
        "item-pepperoni-pizza",
        "item-garlic-knots",
      ]);

      // Should get merchant-specific rates
      expect(taxConfigRepository.getMerchantTaxRateMap).toHaveBeenCalledWith("merchant-1");
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
      ).rejects.toThrow("MERCHANT_NOT_FOUND");
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

  describe("getMenuItemsByCompanyId()", () => {
    beforeEach(() => {
      vi.mocked(menuRepository.getItemsByIdsByCompany).mockResolvedValue(mockMenuItems as never);
    });

    it("should return menu items for given IDs by companyId", async () => {
      const itemIds = ["item-cheese-pizza", "item-pepperoni-pizza"];

      const result = await menuService.getMenuItemsByCompanyId("tenant-1", "company-1", itemIds);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("item-cheese-pizza");
      expect(result[1].id).toBe("item-pepperoni-pizza");
    });

    it("should call menuRepository.getItemsByIdsByCompany with correct params", async () => {
      const itemIds = ["item-cheese-pizza", "item-pepperoni-pizza"];

      await menuService.getMenuItemsByCompanyId("tenant-1", "company-1", itemIds);

      expect(menuRepository.getItemsByIdsByCompany).toHaveBeenCalledWith(
        "tenant-1",
        "company-1",
        itemIds
      );
    });

    it("should return empty array when no items match", async () => {
      vi.mocked(menuRepository.getItemsByIdsByCompany).mockResolvedValue([] as never);

      const result = await menuService.getMenuItemsByCompanyId("tenant-1", "company-1", [
        "non-existent-item",
      ]);

      expect(result).toHaveLength(0);
    });

    it("should not require merchantId lookup", async () => {
      await menuService.getMenuItemsByCompanyId("tenant-1", "company-1", ["item-1"]);

      // Should NOT call merchantRepository since we already have companyId
      expect(merchantRepository.getById).not.toHaveBeenCalled();
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
      categories: [{
        category: {
          id: "cat-pizza",
          name: "Pizza",
        },
      }],
    };

    beforeEach(() => {
      vi.mocked(menuRepository.getItemById).mockResolvedValue(mockMenuItem as never);
    });

    it("should return menu item with category", async () => {
      const result = await menuService.getMenuItem("tenant-1", "item-cheese-pizza");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("item-cheese-pizza");
      expect(result?.name).toBe("Classic Cheese Pizza");
      expect(result?.categories[0]?.category.name).toBe("Pizza");
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

  describe("updateMenuSortOrders()", () => {
    it("should call menuEntityRepository.updateMenuSortOrders with correct params", async () => {
      const updates = [
        { id: "menu-1", sortOrder: 2 },
        { id: "menu-2", sortOrder: 0 },
        { id: "menu-3", sortOrder: 1 },
      ];

      vi.mocked(menuEntityRepository.updateMenuSortOrders).mockResolvedValue([
        { count: 1 },
        { count: 1 },
        { count: 1 },
      ] as never);

      await menuService.updateMenuSortOrders("tenant-1", updates);

      expect(menuEntityRepository.updateMenuSortOrders).toHaveBeenCalledWith(
        "tenant-1",
        updates
      );
    });

    it("should return the result from repository", async () => {
      const updates = [
        { id: "menu-1", sortOrder: 1 },
        { id: "menu-2", sortOrder: 0 },
      ];

      const expectedResult = [{ count: 1 }, { count: 1 }];
      vi.mocked(menuEntityRepository.updateMenuSortOrders).mockResolvedValue(
        expectedResult as never
      );

      const result = await menuService.updateMenuSortOrders("tenant-1", updates);

      expect(result).toEqual(expectedResult);
    });

    it("should handle empty updates array", async () => {
      vi.mocked(menuEntityRepository.updateMenuSortOrders).mockResolvedValue([] as never);

      const result = await menuService.updateMenuSortOrders("tenant-1", []);

      expect(menuEntityRepository.updateMenuSortOrders).toHaveBeenCalledWith(
        "tenant-1",
        []
      );
      expect(result).toEqual([]);
    });
  });
});
