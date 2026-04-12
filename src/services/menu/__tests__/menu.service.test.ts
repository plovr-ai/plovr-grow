import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuService } from "../menu.service";
import { Prisma } from "@prisma/client";

// Mock repositories
vi.mock("@/repositories/menu.repository", () => ({
  menuRepository: {
    getCategoriesWithItemsByCompany: vi.fn(),
    getCategoriesWithItemsByMenu: vi.fn(),
    getCategoriesWithItemsByMenuForDashboard: vi.fn(),
    countActiveItemsByMenuIds: vi.fn(),
    getItemById: vi.fn(),
    getItemsByIdsByCompany: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    deleteCategory: vi.fn(),
    updateCategorySortOrders: vi.fn(),
    updateItemSortOrders: vi.fn(),
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
    setMenuItemTaxConfigs: vi.fn(),
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
    getByTenantId: vi.fn(),
    countActiveByTenantId: vi.fn(),
    setFeaturedItems: vi.fn(),
    addFeaturedItem: vi.fn(),
    removeFeaturedItem: vi.fn(),
    reorderFeaturedItems: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  default: {
    modifierGroup: { upsert: vi.fn() },
    modifierOption: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    menuItemModifierGroup: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/id", () => ({
  generateEntityId: vi.fn(
    () => "gen-" + Math.random().toString(36).slice(2, 8)
  ),
}));

// Import mocked modules
import { menuRepository } from "@/repositories/menu.repository";
import { menuEntityRepository } from "@/repositories/menu-entity.repository";
import { merchantRepository } from "@/repositories/merchant.repository";
import { taxConfigRepository } from "@/repositories/tax-config.repository";
import { menuCategoryItemRepository } from "@/repositories/menu-category-item.repository";
import { featuredItemRepository } from "@/repositories/featured-item.repository";
import prisma from "@/lib/db";

describe("MenuService", () => {
  let menuService: MenuService;

  // Mock data
  const mockMerchant = {
    id: "merchant-1",    name: "Test Merchant",
    slug: "test-merchant",
    logoUrl: "https://example.com/logo.png",
  };

  // Mock menus
  const mockMenus = [
    {
      id: "menu-1",
      tenantId: "tenant-1",      name: "Main Menu",
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
      tenantId: "tenant-1",      menuId: "menu-1",
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
            tenantId: "tenant-1",            name: "Classic Cheese Pizza",
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
            tenantId: "tenant-1",            name: "Pepperoni Pizza",
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
      tenantId: "tenant-1",      menuId: "menu-1",
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
            tenantId: "tenant-1",            name: "Garlic Knots",
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
      tenantId: "tenant-1",      categoryId: "cat-pizza",
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
      tenantId: "tenant-1",      categoryId: "cat-pizza",
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
        tenantId: "tenant-1",        name: "Standard Tax",
        description: null,
        roundingMethod: "half_up",
        isDefault: true,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "tax-alcohol",
        tenantId: "tenant-1",        name: "Alcohol Tax",
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
      vi.mocked(featuredItemRepository.getByTenantId).mockResolvedValue([] as never);
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

  describe("getMenuItemsByTenantId()", () => {
    beforeEach(() => {
      vi.mocked(menuRepository.getItemsByIdsByCompany).mockResolvedValue(mockMenuItems as never);
    });

    it("should return menu items for given IDs by tenantId", async () => {
      const itemIds = ["item-cheese-pizza", "item-pepperoni-pizza"];

      const result = await menuService.getMenuItemsByTenantId("tenant-1", itemIds);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("item-cheese-pizza");
      expect(result[1].id).toBe("item-pepperoni-pizza");
    });

    it("should call menuRepository.getItemsByIdsByCompany with correct params", async () => {
      const itemIds = ["item-cheese-pizza", "item-pepperoni-pizza"];

      await menuService.getMenuItemsByTenantId("tenant-1", itemIds);

      expect(menuRepository.getItemsByIdsByCompany).toHaveBeenCalledWith(
        "tenant-1",
        itemIds
      );
    });

    it("should return empty array when no items match", async () => {
      vi.mocked(menuRepository.getItemsByIdsByCompany).mockResolvedValue([] as never);

      const result = await menuService.getMenuItemsByTenantId("tenant-1", [
        "non-existent-item",
      ]);

      expect(result).toHaveLength(0);
    });

    it("should not require merchantId lookup", async () => {
      await menuService.getMenuItemsByTenantId("tenant-1", ["item-1"]);

      // Should NOT call merchantRepository since we already have tenantId
      expect(merchantRepository.getById).not.toHaveBeenCalled();
    });
  });

  describe("getMenuItem()", () => {
    const mockMenuItem = {
      id: "item-cheese-pizza",
      tenantId: "tenant-1",      categoryId: "cat-pizza",
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

  describe("getMenu() - additional branches", () => {
    const mockItemTaxMap = new Map([
      ["item-cheese-pizza", ["tax-standard"]],
      ["item-pepperoni-pizza", ["tax-standard"]],
      ["item-garlic-knots", ["tax-standard"]],
    ]);

    const mockTaxConfigs = [
      {
        id: "tax-standard",
        tenantId: "tenant-1",        name: "Standard Tax",
        description: null,
        roundingMethod: "half_up",
        isDefault: true,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const mockMerchantTaxRateMap = new Map([["tax-standard", 0.0825]]);

    beforeEach(() => {
      vi.mocked(merchantRepository.getById).mockResolvedValue(mockMerchant as never);
      vi.mocked(menuEntityRepository.getMenusByCompany).mockResolvedValue(mockMenus as never);
      vi.mocked(menuRepository.getCategoriesWithItemsByMenu).mockResolvedValue(
        mockCategoriesWithJunction as never
      );
      vi.mocked(featuredItemRepository.getByTenantId).mockResolvedValue([] as never);
      vi.mocked(taxConfigRepository.getMenuItemsTaxConfigIds).mockResolvedValue(mockItemTaxMap);
      vi.mocked(taxConfigRepository.getTaxConfigsByIds).mockResolvedValue(mockTaxConfigs as never);
      vi.mocked(taxConfigRepository.getMerchantTaxRateMap).mockResolvedValue(mockMerchantTaxRateMap);
    });

    it("should throw error when no menus exist", async () => {
      vi.mocked(menuEntityRepository.getMenusByCompany).mockResolvedValue([] as never);

      await expect(menuService.getMenu("tenant-1", "merchant-1")).rejects.toThrow(
        "MENU_NOT_FOUND"
      );
    });

    it("should use provided menuId when it exists in menus list", async () => {
      const multiMenus = [
        { ...mockMenus[0] },
        {
          id: "menu-2",
          tenantId: "tenant-1",          name: "Lunch Menu",
          description: null,
          sortOrder: 1,
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      vi.mocked(menuEntityRepository.getMenusByCompany).mockResolvedValue(multiMenus as never);

      const result = await menuService.getMenu("tenant-1", "merchant-1", "menu-2");

      expect(result.currentMenuId).toBe("menu-2");
      expect(menuRepository.getCategoriesWithItemsByMenu).toHaveBeenCalledWith(
        "tenant-1",
        "menu-2"
      );
    });

    it("should fallback to first menu when provided menuId not found", async () => {
      const result = await menuService.getMenu("tenant-1", "merchant-1", "non-existent-menu");

      expect(result.currentMenuId).toBe("menu-1");
    });

    it("should return menus info in response", async () => {
      const result = await menuService.getMenu("tenant-1", "merchant-1");

      expect(result.menus).toHaveLength(1);
      expect(result.menus[0]).toEqual({
        id: "menu-1",
        name: "Main Menu",
        description: null,
        sortOrder: 0,
        status: "active",
      });
    });

    it("should filter out null taxes when tax config not found in map", async () => {
      // Item has a tax config ID that doesn't exist in the taxConfigMap
      const taxMapWithUnknown = new Map([
        ["item-cheese-pizza", ["tax-standard", "tax-unknown"]],
      ]);
      vi.mocked(taxConfigRepository.getMenuItemsTaxConfigIds).mockResolvedValue(taxMapWithUnknown);

      const result = await menuService.getMenu("tenant-1", "merchant-1");

      const cheesePizza = result.categories[0].menuItems.find(
        (item: { id: string }) => item.id === "item-cheese-pizza"
      );
      // Should only have tax-standard, tax-unknown should be filtered out
      expect(cheesePizza?.taxes).toHaveLength(1);
      expect(cheesePizza?.taxes![0].taxConfigId).toBe("tax-standard");
    });

    it("should use rate 0 when merchant has no rate for a tax config", async () => {
      const emptyRateMap = new Map<string, number>();
      vi.mocked(taxConfigRepository.getMerchantTaxRateMap).mockResolvedValue(emptyRateMap);

      const result = await menuService.getMenu("tenant-1", "merchant-1");

      const cheesePizza = result.categories[0].menuItems.find(
        (item: { id: string }) => item.id === "item-cheese-pizza"
      );
      expect(cheesePizza?.taxes![0].rate).toBe(0);
    });

    it("should add Featured category when featured items exist on first menu", async () => {
      const mockFeaturedItems = [
        {
          id: "fi-1",
          menuItemId: "item-featured-1",
          sortOrder: 0,
          menuItem: {
            id: "item-featured-1",
            name: "Featured Burger",
            description: "A great burger",
            price: new Prisma.Decimal(12.99),
            imageUrl: "https://example.com/burger.jpg",
            status: "active",
            modifiers: null,
            nutrition: null,
            tags: ["popular"],
          },
        },
      ];

      vi.mocked(featuredItemRepository.getByTenantId).mockResolvedValue(
        mockFeaturedItems as never
      );
      // For featured items tax lookup
      vi.mocked(taxConfigRepository.getMenuItemsTaxConfigIds)
        .mockResolvedValueOnce(mockItemTaxMap)
        .mockResolvedValueOnce(new Map([["item-featured-1", ["tax-standard"]]]));

      const result = await menuService.getMenu("tenant-1", "merchant-1");

      expect(result.categories[0].name).toBe("Featured");
      expect(result.categories[0].id).toBe("featured");
      expect(result.categories[0].menuItems).toHaveLength(1);
      expect(result.categories[0].menuItems[0].name).toBe("Featured Burger");
      expect(result.categories[0].menuItems[0].taxes).toHaveLength(1);
    });

    it("should not add Featured category when featured items are all inactive", async () => {
      const mockFeaturedItems = [
        {
          id: "fi-1",
          menuItemId: "item-featured-1",
          sortOrder: 0,
          menuItem: {
            id: "item-featured-1",
            name: "Inactive Burger",
            description: "An inactive burger",
            price: new Prisma.Decimal(12.99),
            imageUrl: null,
            status: "archived",
            modifiers: null,
            nutrition: null,
            tags: null,
          },
        },
      ];

      vi.mocked(featuredItemRepository.getByTenantId).mockResolvedValue(
        mockFeaturedItems as never
      );

      const result = await menuService.getMenu("tenant-1", "merchant-1");

      // No Featured category since no active items
      expect(result.categories[0].name).toBe("Pizza");
    });

    it("should not add Featured category for non-first menu", async () => {
      const multiMenus = [
        { ...mockMenus[0] },
        {
          id: "menu-2",
          tenantId: "tenant-1",          name: "Lunch Menu",
          description: null,
          sortOrder: 1,
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      vi.mocked(menuEntityRepository.getMenusByCompany).mockResolvedValue(multiMenus as never);

      await menuService.getMenu("tenant-1", "merchant-1", "menu-2");

      // Should NOT call featuredItemRepository for non-first menu
      expect(featuredItemRepository.getByTenantId).not.toHaveBeenCalled();
    });

    it("should fetch missing tax configs for featured items", async () => {
      const mockFeaturedItems = [
        {
          id: "fi-1",
          menuItemId: "item-featured-1",
          sortOrder: 0,
          menuItem: {
            id: "item-featured-1",
            name: "Featured Burger",
            description: "A great burger",
            price: new Prisma.Decimal(12.99),
            imageUrl: null,
            status: "active",
            modifiers: null,
            nutrition: null,
            tags: null,
          },
        },
      ];

      vi.mocked(featuredItemRepository.getByTenantId).mockResolvedValue(
        mockFeaturedItems as never
      );
      // First call for regular items, second for featured items
      vi.mocked(taxConfigRepository.getMenuItemsTaxConfigIds)
        .mockResolvedValueOnce(mockItemTaxMap)
        .mockResolvedValueOnce(new Map([["item-featured-1", ["tax-new"]]]));
      // First call for regular tax configs, second for missing ones
      vi.mocked(taxConfigRepository.getTaxConfigsByIds)
        .mockResolvedValueOnce(mockTaxConfigs as never)
        .mockResolvedValueOnce([
          {
            id: "tax-new",
            tenantId: "tenant-1",            name: "New Tax",
            description: null,
            roundingMethod: "half_up",
            isDefault: false,
            status: "active",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ] as never);

      const result = await menuService.getMenu("tenant-1", "merchant-1");

      // Should have called getTaxConfigsByIds twice
      expect(taxConfigRepository.getTaxConfigsByIds).toHaveBeenCalledTimes(2);
      // Featured item should have tax info
      const featuredCategory = result.categories.find((c: { id: string }) => c.id === "featured");
      expect(featuredCategory?.menuItems[0].taxes).toHaveLength(1);
      expect(featuredCategory?.menuItems[0].taxes![0].name).toBe("New Tax");
    });
  });

  describe("getMenu() - preloadedMerchant option", () => {
    beforeEach(() => {
      vi.mocked(menuEntityRepository.getMenusByCompany).mockResolvedValue(mockMenus as never);
      vi.mocked(menuRepository.getCategoriesWithItemsByMenu).mockResolvedValue([] as never);
      vi.mocked(featuredItemRepository.getByTenantId).mockResolvedValue([] as never);
      vi.mocked(taxConfigRepository.getMenuItemsTaxConfigIds).mockResolvedValue(new Map());
      vi.mocked(taxConfigRepository.getTaxConfigsByIds).mockResolvedValue([] as never);
      vi.mocked(taxConfigRepository.getMerchantTaxRateMap).mockResolvedValue(new Map());
    });

    it("should skip merchantRepository.getById when preloadedMerchant is provided", async () => {
      const result = await menuService.getMenu("tenant-1", "merchant-1", undefined, {
        preloadedMerchant: {
          id: "merchant-1",
          name: "Preloaded Merchant",
          logoUrl: "https://example.com/preloaded.png",
        },
      });

      expect(merchantRepository.getById).not.toHaveBeenCalled();
      expect(result.merchantName).toBe("Preloaded Merchant");
      expect(result.merchantLogo).toBe("https://example.com/preloaded.png");
    });

    it("should throw MERCHANT_NOT_FOUND when preloadedMerchant is null", async () => {
      await expect(
        menuService.getMenu("tenant-1", "merchant-1", undefined, {
          preloadedMerchant: null,
        })
      ).rejects.toThrow("MERCHANT_NOT_FOUND");
      expect(merchantRepository.getById).not.toHaveBeenCalled();
    });

    it("should fall back to merchantRepository.getById when options omitted", async () => {
      vi.mocked(merchantRepository.getById).mockResolvedValue(mockMerchant as never);

      await menuService.getMenu("tenant-1", "merchant-1");

      expect(merchantRepository.getById).toHaveBeenCalledWith("merchant-1");
    });
  });

  describe("countActiveItemsByMenuIds()", () => {
    it("should delegate to menuRepository.countActiveItemsByMenuIds", async () => {
      const countMap = new Map([
        ["menu-1", 3],
        ["menu-2", 0],
      ]);
      vi.mocked(menuRepository.countActiveItemsByMenuIds).mockResolvedValue(countMap);

      const result = await menuService.countActiveItemsByMenuIds("tenant-1", [
        "menu-1",
        "menu-2",
      ]);

      expect(menuRepository.countActiveItemsByMenuIds).toHaveBeenCalledWith(
        "tenant-1",
        ["menu-1", "menu-2"]
      );
      expect(result).toBe(countMap);
    });
  });

  describe("countActiveFeaturedItems()", () => {
    it("should delegate to featuredItemRepository.countActiveByTenantId", async () => {
      vi.mocked(featuredItemRepository.countActiveByTenantId).mockResolvedValue(7);

      const result = await menuService.countActiveFeaturedItems("tenant-1");

      expect(featuredItemRepository.countActiveByTenantId).toHaveBeenCalledWith(
        "tenant-1"
      );
      expect(result).toBe(7);
    });
  });

  describe("getMenus()", () => {
    it("should return menus for a company", async () => {
      vi.mocked(menuEntityRepository.getMenusByCompany).mockResolvedValue(mockMenus as never);

      const result = await menuService.getMenus("tenant-1");

      expect(menuEntityRepository.getMenusByCompany).toHaveBeenCalledWith("tenant-1");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "menu-1",
        name: "Main Menu",
        description: null,
        sortOrder: 0,
        status: "active",
      });
    });

    it("should return empty array when no menus exist", async () => {
      vi.mocked(menuEntityRepository.getMenusByCompany).mockResolvedValue([] as never);

      const result = await menuService.getMenus("tenant-1");

      expect(result).toHaveLength(0);
    });
  });

  describe("createMenu()", () => {
    it("should create a menu and return result", async () => {
      const mockResult = { id: "menu-new", name: "New Menu" };
      vi.mocked(menuEntityRepository.createMenu).mockResolvedValue(mockResult as never);

      const result = await menuService.createMenu("tenant-1", {
        name: "New Menu",
        sortOrder: 0,
      });

      expect(menuEntityRepository.createMenu).toHaveBeenCalledWith("tenant-1", {
        name: "New Menu",
        sortOrder: 0,
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe("updateMenu()", () => {
    it("should update a menu", async () => {
      const mockResult = { id: "menu-1", name: "Updated Menu" };
      vi.mocked(menuEntityRepository.updateMenu).mockResolvedValue(mockResult as never);

      const result = await menuService.updateMenu("tenant-1", "menu-1", { name: "Updated Menu" });

      expect(menuEntityRepository.updateMenu).toHaveBeenCalledWith("tenant-1", "menu-1", {
        name: "Updated Menu",
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe("deleteMenu()", () => {
    it("should delete a menu", async () => {
      vi.mocked(menuEntityRepository.deleteMenu).mockResolvedValue({ count: 1 } as never);

      const result = await menuService.deleteMenu("tenant-1", "menu-1");

      expect(menuEntityRepository.deleteMenu).toHaveBeenCalledWith("tenant-1", "menu-1");
      expect(result).toEqual({ count: 1 });
    });
  });

  describe("countMenus()", () => {
    it("should return menu count", async () => {
      vi.mocked(menuEntityRepository.countMenusByCompany).mockResolvedValue(3 as never);

      const result = await menuService.countMenus("tenant-1");

      expect(menuEntityRepository.countMenusByCompany).toHaveBeenCalledWith("tenant-1");
      expect(result).toBe(3);
    });
  });

  describe("createCategory()", () => {
    it("should create a category with all fields", async () => {
      const mockResult = { id: "cat-new", name: "New Category" };
      vi.mocked(menuRepository.createCategory).mockResolvedValue(mockResult as never);

      const result = await menuService.createCategory("tenant-1", {
        menuId: "menu-1",
        name: "New Category",
        description: "A description",
        imageUrl: "https://example.com/img.jpg",
        sortOrder: 5,
      });

      expect(menuRepository.createCategory).toHaveBeenCalledWith("tenant-1", "menu-1", {
        name: "New Category",
        description: "A description",
        imageUrl: "https://example.com/img.jpg",
        sortOrder: 5,
      });
      expect(result).toEqual(mockResult);
    });

    it("should default sortOrder to 0 when not provided", async () => {
      const mockResult = { id: "cat-new", name: "New Category" };
      vi.mocked(menuRepository.createCategory).mockResolvedValue(mockResult as never);

      await menuService.createCategory("tenant-1", {
        menuId: "menu-1",
        name: "New Category",
      });

      expect(menuRepository.createCategory).toHaveBeenCalledWith("tenant-1", "menu-1", {
        name: "New Category",
        description: undefined,
        imageUrl: undefined,
        sortOrder: 0,
      });
    });
  });

  describe("updateCategory()", () => {
    it("should update a category", async () => {
      const mockResult = { id: "cat-1", name: "Updated" };
      vi.mocked(menuRepository.updateCategory).mockResolvedValue(mockResult as never);

      const result = await menuService.updateCategory("tenant-1", "cat-1", { name: "Updated" });

      expect(menuRepository.updateCategory).toHaveBeenCalledWith("tenant-1", "cat-1", { name: "Updated" });
      expect(result).toEqual(mockResult);
    });
  });

  describe("createMenuItem()", () => {
    it("should create a menu item and link to categories", async () => {
      const mockItem = { id: "item-new", name: "New Item" };
      vi.mocked(menuRepository.createItem).mockResolvedValue(mockItem as never);
      vi.mocked(menuCategoryItemRepository.getNextSortOrder).mockResolvedValue(0 as never);
      vi.mocked(menuCategoryItemRepository.linkItemToCategory).mockResolvedValue(undefined as never);

      const result = await menuService.createMenuItem("tenant-1", {
        categoryIds: ["cat-1", "cat-2"],
        name: "New Item",
        description: "Desc",
        price: 9.99,
        imageUrl: "https://example.com/img.jpg",
        modifierGroups: [{ id: "mg-size", name: "Size", type: "single" as const, required: true, modifiers: [{ id: "mod-small", name: "Small", price: 0 }] }],
        tags: ["vegan"],
      });

      expect(menuRepository.createItem).toHaveBeenCalledWith("tenant-1", {
        name: "New Item",
        description: "Desc",
        price: 9.99,
        imageUrl: "https://example.com/img.jpg",
        modifiers: [{ id: "mg-size", name: "Size", type: "single", required: true, modifiers: [{ id: "mod-small", name: "Small", price: 0 }] }],
        tags: ["vegan"],
      });
      expect(menuCategoryItemRepository.getNextSortOrder).toHaveBeenCalledTimes(2);
      expect(menuCategoryItemRepository.linkItemToCategory).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockItem);
    });

    it("should handle null modifiers and tags", async () => {
      const mockItem = { id: "item-new", name: "Simple Item" };
      vi.mocked(menuRepository.createItem).mockResolvedValue(mockItem as never);
      vi.mocked(menuCategoryItemRepository.getNextSortOrder).mockResolvedValue(0 as never);
      vi.mocked(menuCategoryItemRepository.linkItemToCategory).mockResolvedValue(undefined as never);

      await menuService.createMenuItem("tenant-1", {
        categoryIds: ["cat-1"],
        name: "Simple Item",
        price: 5.99,
      });

      expect(menuRepository.createItem).toHaveBeenCalledWith("tenant-1", {
        name: "Simple Item",
        description: undefined,
        price: 5.99,
        imageUrl: undefined,
        modifiers: null,
        tags: null,
      });
    });

    it("should sync multiple-type modifier groups with allowQuantity to normalized tables", async () => {
      const mockItem = { id: "item-new", name: "Pizza" };
      vi.mocked(menuRepository.createItem).mockResolvedValue(mockItem as never);
      vi.mocked(menuCategoryItemRepository.getNextSortOrder).mockResolvedValue(0 as never);
      vi.mocked(menuCategoryItemRepository.linkItemToCategory).mockResolvedValue(undefined as never);

      await menuService.createMenuItem("tenant-1", {
        categoryIds: ["cat-1"],
        name: "Pizza",
        price: 15.99,
        modifierGroups: [
          {
            id: "mg-toppings",
            name: "Toppings",
            type: "multiple",
            required: false,
            allowQuantity: true,
            maxQuantityPerModifier: 3,
            modifiers: [
              { id: "mod-cheese", name: "Extra Cheese", price: 1.5 },
              { id: "mod-pepperoni", name: "Pepperoni", price: 2 },
            ],
          },
        ],
      });

      // Verify item was created
      expect(menuRepository.createItem).toHaveBeenCalledTimes(1);
      // syncModifierGroupsToTables is called internally and uses the mocked prisma
    });
  });

  describe("updateMenuItem()", () => {
    it("should update item fields selectively", async () => {
      vi.mocked(menuRepository.updateItem).mockResolvedValue(undefined as never);

      await menuService.updateMenuItem("tenant-1", "item-1", {
        name: "Updated Name",
        price: 15.99,
      });

      expect(menuRepository.updateItem).toHaveBeenCalledWith("tenant-1", "item-1", {
        name: "Updated Name",
        price: 15.99,
      });
    });

    it("should update all possible fields", async () => {
      vi.mocked(menuRepository.updateItem).mockResolvedValue(undefined as never);
      vi.mocked(menuCategoryItemRepository.setItemCategories).mockResolvedValue(undefined as never);

      await menuService.updateMenuItem("tenant-1", "item-1", {
        name: "Updated",
        description: "New desc",
        price: 20,
        imageUrl: "https://example.com/new.jpg",
        status: "out_of_stock",
        modifierGroups: [],
        tags: ["new-tag"],
        categoryIds: ["cat-1", "cat-2"],
      });

      expect(menuRepository.updateItem).toHaveBeenCalledWith("tenant-1", "item-1", {
        name: "Updated",
        description: "New desc",
        price: 20,
        imageUrl: "https://example.com/new.jpg",
        status: "out_of_stock",
        modifiers: [],
        tags: ["new-tag"],
      });
      expect(menuCategoryItemRepository.setItemCategories).toHaveBeenCalledWith(
        "tenant-1",
        "item-1",
        ["cat-1", "cat-2"]
      );
    });

    it("should handle update with no fields (empty input)", async () => {
      vi.mocked(menuRepository.updateItem).mockResolvedValue(undefined as never);

      await menuService.updateMenuItem("tenant-1", "item-1", {});

      expect(menuRepository.updateItem).toHaveBeenCalledWith("tenant-1", "item-1", {});
    });

    it("should not update category associations when categoryIds not provided", async () => {
      vi.mocked(menuRepository.updateItem).mockResolvedValue(undefined as never);

      await menuService.updateMenuItem("tenant-1", "item-1", { name: "Updated" });

      expect(menuCategoryItemRepository.setItemCategories).not.toHaveBeenCalled();
    });

    it("should sync modifier groups to normalized tables on update", async () => {
      vi.mocked(menuRepository.updateItem).mockResolvedValue(undefined as never);

      await menuService.updateMenuItem("tenant-1", "item-1", {
        modifierGroups: [
          {
            id: "mg-size",
            name: "Size",
            type: "single",
            required: true,
            modifiers: [
              { id: "opt-sm", name: "Small", price: 0, isDefault: true, isAvailable: true },
              { id: "opt-lg", name: "Large", price: 3, isDefault: false, isAvailable: true },
            ],
          },
          {
            id: "mg-extras",
            name: "Extras",
            type: "multiple",
            required: false,
            allowQuantity: true,
            maxQuantityPerModifier: 5,
            modifiers: [
              { id: "opt-cheese", name: "Extra Cheese", price: 1.5, isDefault: false },
            ],
          },
        ],
      });

      // Verify updateItem was called with JSON data for backward compat
      expect(menuRepository.updateItem).toHaveBeenCalledTimes(1);
    });
  });

  describe("deleteMenuItem()", () => {
    it("should delete a menu item", async () => {
      vi.mocked(menuRepository.deleteItem).mockResolvedValue({ count: 1 } as never);

      const result = await menuService.deleteMenuItem("tenant-1", "item-1");

      expect(menuRepository.deleteItem).toHaveBeenCalledWith("tenant-1", "item-1");
      expect(result).toEqual({ count: 1 });
    });
  });

  describe("deleteCategory()", () => {
    it("should delete a category", async () => {
      vi.mocked(menuRepository.deleteCategory).mockResolvedValue({ count: 1 } as never);

      const result = await menuService.deleteCategory("tenant-1", "cat-1");

      expect(menuRepository.deleteCategory).toHaveBeenCalledWith("tenant-1", "cat-1");
      expect(result).toEqual({ count: 1 });
    });
  });

  describe("updateCategorySortOrders()", () => {
    it("should update category sort orders", async () => {
      const updates = [
        { id: "cat-1", sortOrder: 2 },
        { id: "cat-2", sortOrder: 0 },
      ];
      vi.mocked(menuRepository.updateCategorySortOrders).mockResolvedValue([{ count: 1 }, { count: 1 }] as never);

      const result = await menuService.updateCategorySortOrders("tenant-1", updates);

      expect(menuRepository.updateCategorySortOrders).toHaveBeenCalledWith("tenant-1", updates);
      expect(result).toEqual([{ count: 1 }, { count: 1 }]);
    });
  });

  describe("updateMenuItemSortOrders()", () => {
    it("should update item sort orders within a category", async () => {
      const updates = [
        { id: "item-1", sortOrder: 1 },
        { id: "item-2", sortOrder: 0 },
      ];
      vi.mocked(menuRepository.updateItemSortOrders).mockResolvedValue([{ count: 1 }, { count: 1 }] as never);

      const result = await menuService.updateMenuItemSortOrders("cat-1", updates);

      expect(menuRepository.updateItemSortOrders).toHaveBeenCalledWith("cat-1", updates);
      expect(result).toEqual([{ count: 1 }, { count: 1 }]);
    });
  });

  describe("getMenuForDashboard()", () => {
    const mockDashboardCategories = [
      {
        id: "cat-pizza",
        name: "Pizza",
        description: "Our famous pizzas",
        imageUrl: null,
        sortOrder: 1,
        status: "active",
        categoryItems: [
          {
            sortOrder: 1,
            menuItem: {
              id: "item-cheese-pizza",
              name: "Classic Cheese Pizza",
              description: "Fresh mozzarella",
              price: new Prisma.Decimal(18.99),
              imageUrl: null,
              status: "active",
              modifiers: [{ name: "Size", required: true, minSelections: 1, maxSelections: 1, options: [] }],
              tags: ["vegetarian"],
            },
          },
        ],
      },
    ];

    beforeEach(() => {
      vi.mocked(menuEntityRepository.getMenusByCompanyForDashboard).mockResolvedValue(mockMenus as never);
      vi.mocked(menuRepository.getCategoriesWithItemsByMenuForDashboard).mockResolvedValue(
        mockDashboardCategories as never
      );
      vi.mocked(taxConfigRepository.getMenuItemsTaxConfigIds).mockResolvedValue(
        new Map([["item-cheese-pizza", ["tax-1"]]])
      );
      vi.mocked(menuCategoryItemRepository.getItemsCategoryIds).mockResolvedValue(
        new Map([["item-cheese-pizza", ["cat-pizza"]]])
      );
    });

    it("should return dashboard menu response", async () => {
      const result = await menuService.getMenuForDashboard("tenant-1");

      expect(result.menus).toHaveLength(1);
      expect(result.currentMenuId).toBe("menu-1");
      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].menuItems[0].price).toBe(18.99);
      expect(result.categories[0].menuItems[0].taxConfigIds).toEqual(["tax-1"]);
      expect(result.categories[0].menuItems[0].categoryIds).toEqual(["cat-pizza"]);
    });

    it("should create default menu when no menus exist", async () => {
      const defaultMenu = {
        id: "menu-default",
        tenantId: "tenant-1",        name: "Main Menu",
        description: null,
        sortOrder: 0,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(menuEntityRepository.getMenusByCompanyForDashboard).mockResolvedValue([] as never);
      vi.mocked(menuEntityRepository.createMenu).mockResolvedValue(defaultMenu as never);
      vi.mocked(menuRepository.getCategoriesWithItemsByMenuForDashboard).mockResolvedValue([] as never);
      vi.mocked(taxConfigRepository.getMenuItemsTaxConfigIds).mockResolvedValue(new Map());
      vi.mocked(menuCategoryItemRepository.getItemsCategoryIds).mockResolvedValue(new Map());

      const result = await menuService.getMenuForDashboard("tenant-1");

      expect(menuEntityRepository.createMenu).toHaveBeenCalledWith("tenant-1", {
        name: "Main Menu",
        sortOrder: 0,
      });
      expect(result.currentMenuId).toBe("menu-default");
    });

    it("should use provided menuId when valid", async () => {
      const multiMenus = [
        { ...mockMenus[0] },
        {
          id: "menu-2",
          tenantId: "tenant-1",          name: "Lunch Menu",
          description: null,
          sortOrder: 1,
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      vi.mocked(menuEntityRepository.getMenusByCompanyForDashboard).mockResolvedValue(multiMenus as never);

      const result = await menuService.getMenuForDashboard("tenant-1", "menu-2");

      expect(result.currentMenuId).toBe("menu-2");
    });

    it("should fallback to first menu when menuId not found", async () => {
      const result = await menuService.getMenuForDashboard("tenant-1", "non-existent");

      expect(result.currentMenuId).toBe("menu-1");
    });

    it("should handle items without modifiers or tags", async () => {
      const categoriesWithNullFields = [
        {
          id: "cat-1",
          name: "Simple",
          description: null,
          imageUrl: null,
          sortOrder: 0,
          status: "active",
          categoryItems: [
            {
              sortOrder: 0,
              menuItem: {
                id: "item-1",
                name: "Simple Item",
                description: null,
                price: new Prisma.Decimal(5),
                imageUrl: null,
                status: "active",
                modifiers: null,
                tags: null,
              },
            },
          ],
        },
      ];
      vi.mocked(menuRepository.getCategoriesWithItemsByMenuForDashboard).mockResolvedValue(
        categoriesWithNullFields as never
      );
      vi.mocked(taxConfigRepository.getMenuItemsTaxConfigIds).mockResolvedValue(new Map());
      vi.mocked(menuCategoryItemRepository.getItemsCategoryIds).mockResolvedValue(new Map());

      const result = await menuService.getMenuForDashboard("tenant-1");

      expect(result.categories[0].menuItems[0].modifierGroups).toEqual([]);
      expect(result.categories[0].menuItems[0].tags).toEqual([]);
      expect(result.categories[0].menuItems[0].taxConfigIds).toEqual([]);
      expect(result.categories[0].menuItems[0].categoryIds).toEqual([]);
    });

    it("should pass showArchived flag to repository", async () => {
      await menuService.getMenuForDashboard("tenant-1", undefined, true);

      expect(menuRepository.getCategoriesWithItemsByMenuForDashboard).toHaveBeenCalledWith(
        "tenant-1",
        "menu-1",
        true
      );
    });

    it("should extract modifier groups from relational data when present", async () => {
      const categoriesWithRelationalModifiers = [
        {
          id: "cat-1",
          name: "Mains",
          description: null,
          imageUrl: null,
          sortOrder: 0,
          status: "active",
          categoryItems: [
            {
              sortOrder: 0,
              menuItem: {
                id: "item-1",
                name: "Burger",
                description: null,
                price: new Prisma.Decimal(12.99),
                imageUrl: null,
                status: "active",
                modifiers: null, // JSON field is null
                tags: null,
                modifierGroups: [
                  {
                    sortOrder: 0,
                    modifierGroup: {
                      id: "mg-size",
                      name: "Size",
                      required: true,
                      minSelect: 1,
                      maxSelect: 1,
                      allowQuantity: false,
                      maxQuantityPerModifier: 1,
                      options: [
                        {
                          id: "opt-sm",
                          name: "Small",
                          price: new Prisma.Decimal(0),
                          isDefault: true,
                          isAvailable: true,
                          sortOrder: 0,
                        },
                        {
                          id: "opt-lg",
                          name: "Large",
                          price: new Prisma.Decimal(3),
                          isDefault: false,
                          isAvailable: true,
                          sortOrder: 1,
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      ];

      vi.mocked(menuRepository.getCategoriesWithItemsByMenuForDashboard).mockResolvedValue(
        categoriesWithRelationalModifiers as never
      );
      vi.mocked(taxConfigRepository.getMenuItemsTaxConfigIds).mockResolvedValue(new Map());
      vi.mocked(menuCategoryItemRepository.getItemsCategoryIds).mockResolvedValue(new Map());

      const result = await menuService.getMenuForDashboard("tenant-1");

      const modGroups = result.categories[0].menuItems[0].modifierGroups;
      expect(modGroups).toHaveLength(1);
      expect(modGroups[0].id).toBe("mg-size");
      expect(modGroups[0].name).toBe("Size");
      expect(modGroups[0].type).toBe("single");
      expect(modGroups[0].required).toBe(true);
      expect(modGroups[0].modifiers).toHaveLength(2);
      expect(modGroups[0].modifiers[0].name).toBe("Small");
      expect(modGroups[0].modifiers[0].price).toBe(0);
      expect(modGroups[0].modifiers[1].name).toBe("Large");
      expect(modGroups[0].modifiers[1].price).toBe(3);
    });

    it("should handle multiple-select groups with allowQuantity from relational data", async () => {
      const categoriesWithMultiSelect = [
        {
          id: "cat-1",
          name: "Mains",
          description: null,
          imageUrl: null,
          sortOrder: 0,
          status: "active",
          categoryItems: [
            {
              sortOrder: 0,
              menuItem: {
                id: "item-1",
                name: "Pizza",
                description: null,
                price: new Prisma.Decimal(15),
                imageUrl: null,
                status: "active",
                modifiers: null,
                tags: null,
                modifierGroups: [
                  {
                    sortOrder: 0,
                    modifierGroup: {
                      id: "mg-toppings",
                      name: "Toppings",
                      required: false,
                      minSelect: 0,
                      maxSelect: 5,
                      allowQuantity: true,
                      maxQuantityPerModifier: 3,
                      options: [
                        {
                          id: "opt-cheese",
                          name: "Extra Cheese",
                          price: new Prisma.Decimal(1.5),
                          isDefault: false,
                          isAvailable: true,
                          sortOrder: 0,
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      ];

      vi.mocked(menuRepository.getCategoriesWithItemsByMenuForDashboard).mockResolvedValue(
        categoriesWithMultiSelect as never
      );
      vi.mocked(taxConfigRepository.getMenuItemsTaxConfigIds).mockResolvedValue(new Map());
      vi.mocked(menuCategoryItemRepository.getItemsCategoryIds).mockResolvedValue(new Map());

      const result = await menuService.getMenuForDashboard("tenant-1");

      const modGroups = result.categories[0].menuItems[0].modifierGroups;
      expect(modGroups).toHaveLength(1);
      expect(modGroups[0].type).toBe("multiple");
      expect(modGroups[0].allowQuantity).toBe(true);
      expect(modGroups[0].maxQuantityPerModifier).toBe(3);
    });

    it("should handle relational group with no options (edge case)", async () => {
      const categoriesWithNoOptions = [
        {
          id: "cat-1",
          name: "Mains",
          description: null,
          imageUrl: null,
          sortOrder: 0,
          status: "active",
          categoryItems: [
            {
              sortOrder: 0,
              menuItem: {
                id: "item-1",
                name: "Plain Item",
                description: null,
                price: new Prisma.Decimal(10),
                imageUrl: null,
                status: "active",
                modifiers: null,
                tags: null,
                modifierGroups: [
                  {
                    sortOrder: 0,
                    modifierGroup: {
                      id: "mg-empty",
                      name: "Empty Group",
                      required: false,
                      minSelect: 0,
                      maxSelect: 1,
                      allowQuantity: false,
                      maxQuantityPerModifier: 1,
                      options: undefined, // no options
                    },
                  },
                ],
              },
            },
          ],
        },
      ];

      vi.mocked(menuRepository.getCategoriesWithItemsByMenuForDashboard).mockResolvedValue(
        categoriesWithNoOptions as never
      );
      vi.mocked(taxConfigRepository.getMenuItemsTaxConfigIds).mockResolvedValue(new Map());
      vi.mocked(menuCategoryItemRepository.getItemsCategoryIds).mockResolvedValue(new Map());

      const result = await menuService.getMenuForDashboard("tenant-1");

      const modGroups = result.categories[0].menuItems[0].modifierGroups;
      expect(modGroups).toHaveLength(1);
      expect(modGroups[0].modifiers).toEqual([]);
    });

    it("should fall back to JSON modifiers when relational data is empty", async () => {
      const categoriesWithJsonOnly = [
        {
          id: "cat-1",
          name: "Mains",
          description: null,
          imageUrl: null,
          sortOrder: 0,
          status: "active",
          categoryItems: [
            {
              sortOrder: 0,
              menuItem: {
                id: "item-1",
                name: "Burger",
                description: null,
                price: new Prisma.Decimal(12.99),
                imageUrl: null,
                status: "active",
                modifiers: [
                  {
                    id: "json-size",
                    name: "Size (JSON)",
                    type: "single",
                    required: true,
                    modifiers: [
                      { id: "j1", name: "Regular", price: 0, isDefault: true, isAvailable: true },
                    ],
                  },
                ],
                tags: null,
                modifierGroups: [], // empty relational data
              },
            },
          ],
        },
      ];

      vi.mocked(menuRepository.getCategoriesWithItemsByMenuForDashboard).mockResolvedValue(
        categoriesWithJsonOnly as never
      );
      vi.mocked(taxConfigRepository.getMenuItemsTaxConfigIds).mockResolvedValue(new Map());
      vi.mocked(menuCategoryItemRepository.getItemsCategoryIds).mockResolvedValue(new Map());

      const result = await menuService.getMenuForDashboard("tenant-1");

      const modGroups = result.categories[0].menuItems[0].modifierGroups;
      expect(modGroups).toHaveLength(1);
      expect(modGroups[0].id).toBe("json-size");
      expect(modGroups[0].name).toBe("Size (JSON)");
    });
  });

  describe("setMenuItemTaxConfigs()", () => {
    it("should set tax configs for a menu item", async () => {
      vi.mocked(taxConfigRepository.setMenuItemTaxConfigs).mockResolvedValue(undefined as never);

      await menuService.setMenuItemTaxConfigs("tenant-1", "item-1", ["tax-1", "tax-2"]);

      expect(taxConfigRepository.setMenuItemTaxConfigs).toHaveBeenCalledWith("tenant-1", "item-1", [
        "tax-1",
        "tax-2",
      ]);
    });
  });

  describe("linkItemToCategory()", () => {
    it("should link an item to a category with correct sort order", async () => {
      vi.mocked(menuCategoryItemRepository.getNextSortOrder).mockResolvedValue(3 as never);
      vi.mocked(menuCategoryItemRepository.linkItemToCategory).mockResolvedValue(undefined as never);

      await menuService.linkItemToCategory("tenant-1", "cat-1", "item-1");

      expect(menuCategoryItemRepository.getNextSortOrder).toHaveBeenCalledWith("cat-1");
      expect(menuCategoryItemRepository.linkItemToCategory).toHaveBeenCalledWith(
        "tenant-1",
        "cat-1",
        "item-1",
        3
      );
    });
  });

  describe("unlinkItemFromCategory()", () => {
    it("should unlink an item from a category", async () => {
      vi.mocked(menuCategoryItemRepository.unlinkItemFromCategory).mockResolvedValue(undefined as never);

      await menuService.unlinkItemFromCategory("tenant-1", "cat-1", "item-1");

      expect(menuCategoryItemRepository.unlinkItemFromCategory).toHaveBeenCalledWith("cat-1", "item-1");
    });
  });

  describe("getAvailableItems()", () => {
    it("should return available items with category names", async () => {
      const mockItems = [
        {
          id: "item-1",
          name: "Burger",
          description: "A burger",
          price: new Prisma.Decimal(10.99),
          imageUrl: "https://example.com/burger.jpg",
          categories: [
            { category: { name: "Lunch" } },
            { category: { name: "Dinner" } },
          ],
        },
      ];
      vi.mocked(menuCategoryItemRepository.getItemsNotInCategory).mockResolvedValue(
        mockItems as never
      );

      const result = await menuService.getAvailableItems("tenant-1", "cat-1");

      expect(menuCategoryItemRepository.getItemsNotInCategory).toHaveBeenCalledWith(
        "tenant-1",
        "cat-1"
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "item-1",
        name: "Burger",
        description: "A burger",
        price: 10.99,
        imageUrl: "https://example.com/burger.jpg",
        categoryNames: ["Lunch", "Dinner"],
      });
    });

    it("should return empty array when no items available", async () => {
      vi.mocked(menuCategoryItemRepository.getItemsNotInCategory).mockResolvedValue([] as never);

      const result = await menuService.getAvailableItems("tenant-1", "cat-1");

      expect(result).toHaveLength(0);
    });
  });

  describe("countItemCategories()", () => {
    it("should return the count of categories for an item", async () => {
      vi.mocked(menuCategoryItemRepository.countItemCategories).mockResolvedValue(3 as never);

      const result = await menuService.countItemCategories("item-1");

      expect(menuCategoryItemRepository.countItemCategories).toHaveBeenCalledWith("item-1");
      expect(result).toBe(3);
    });
  });

  describe("getFeaturedItems()", () => {
    it("should return featured items with mapped data", async () => {
      const mockFeaturedItems = [
        {
          id: "fi-1",
          menuItemId: "item-1",
          sortOrder: 0,
          menuItem: {
            id: "item-1",
            name: "Featured Burger",
            description: "A great burger",
            price: new Prisma.Decimal(12.99),
            imageUrl: "https://example.com/burger.jpg",
            status: "active",
          },
        },
      ];
      vi.mocked(featuredItemRepository.getByTenantId).mockResolvedValue(
        mockFeaturedItems as never
      );

      const result = await menuService.getFeaturedItems("tenant-1");

      expect(featuredItemRepository.getByTenantId).toHaveBeenCalledWith("tenant-1");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "fi-1",
        menuItemId: "item-1",
        sortOrder: 0,
        menuItem: {
          id: "item-1",
          name: "Featured Burger",
          description: "A great burger",
          price: 12.99,
          imageUrl: "https://example.com/burger.jpg",
          status: "active",
        },
      });
    });

    it("should return empty array when no featured items", async () => {
      vi.mocked(featuredItemRepository.getByTenantId).mockResolvedValue([] as never);

      const result = await menuService.getFeaturedItems("tenant-1");

      expect(result).toHaveLength(0);
    });
  });

  describe("setFeaturedItems()", () => {
    it("should set featured items", async () => {
      vi.mocked(featuredItemRepository.setFeaturedItems).mockResolvedValue(undefined as never);

      await menuService.setFeaturedItems("tenant-1", ["item-1", "item-2"]);

      expect(featuredItemRepository.setFeaturedItems).toHaveBeenCalledWith(
        "tenant-1",
        ["item-1", "item-2"]
      );
    });
  });

  describe("addFeaturedItem()", () => {
    it("should add a featured item", async () => {
      vi.mocked(featuredItemRepository.addFeaturedItem).mockResolvedValue(undefined as never);

      await menuService.addFeaturedItem("tenant-1", "item-1");

      expect(featuredItemRepository.addFeaturedItem).toHaveBeenCalledWith(
        "tenant-1",
        "item-1"
      );
    });
  });

  describe("removeFeaturedItem()", () => {
    it("should remove a featured item", async () => {
      vi.mocked(featuredItemRepository.removeFeaturedItem).mockResolvedValue(undefined as never);

      await menuService.removeFeaturedItem("tenant-1", "item-1");

      expect(featuredItemRepository.removeFeaturedItem).toHaveBeenCalledWith(
        "tenant-1",
        "item-1"
      );
    });
  });

  describe("reorderFeaturedItems()", () => {
    it("should reorder featured items", async () => {
      vi.mocked(featuredItemRepository.reorderFeaturedItems).mockResolvedValue(undefined as never);

      await menuService.reorderFeaturedItems("tenant-1", ["item-2", "item-1"]);

      expect(featuredItemRepository.reorderFeaturedItems).toHaveBeenCalledWith(
        "tenant-1",
        ["item-2", "item-1"]
      );
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

  describe("syncModifierGroups()", () => {
    const tenantId = "tenant-1";
    const menuItemId = "item-1";

    const sampleGroups = [
      {
        id: "mg-size",
        name: "Size",
        type: "single" as const,
        required: true,
        modifiers: [
          { id: "mod-small", name: "Small", price: 0 },
          { id: "mod-large", name: "Large", price: 2.5 },
        ],
      },
    ];

    it("should use provided tx client when given", async () => {
      const txClient = {
        modifierGroup: { upsert: vi.fn().mockResolvedValue({}) },
        modifierOption: {
          upsert: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        menuItemModifierGroup: {
          create: vi.fn().mockResolvedValue({}),
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      };

      await menuService.syncModifierGroups(
        tenantId,
        menuItemId,
        sampleGroups,
        txClient as never
      );

      // tx client should be used, not the default prisma
      expect(txClient.menuItemModifierGroup.deleteMany).toHaveBeenCalledWith({
        where: { menuItemId },
      });
      expect(txClient.modifierGroup.upsert).toHaveBeenCalled();
      expect(txClient.modifierOption.upsert).toHaveBeenCalledTimes(2);
      expect(txClient.menuItemModifierGroup.create).toHaveBeenCalled();

      // Default prisma should NOT have been called
      expect(prisma.menuItemModifierGroup.deleteMany).not.toHaveBeenCalled();
      expect(prisma.modifierGroup.upsert).not.toHaveBeenCalled();
    });

    it("should fall back to default prisma when no tx provided", async () => {
      vi.mocked(prisma.menuItemModifierGroup.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.modifierGroup.upsert).mockResolvedValue({} as never);
      vi.mocked(prisma.modifierOption.upsert).mockResolvedValue({} as never);
      vi.mocked(prisma.modifierOption.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.menuItemModifierGroup.create).mockResolvedValue({} as never);

      await menuService.syncModifierGroups(tenantId, menuItemId, sampleGroups);

      expect(prisma.menuItemModifierGroup.deleteMany).toHaveBeenCalledWith({
        where: { menuItemId },
      });
      expect(prisma.modifierGroup.upsert).toHaveBeenCalled();
    });

    it("should clear all modifier groups when given empty array", async () => {
      vi.mocked(prisma.menuItemModifierGroup.deleteMany).mockResolvedValue({ count: 0 });

      await menuService.syncModifierGroups(tenantId, menuItemId, []);

      expect(prisma.menuItemModifierGroup.deleteMany).toHaveBeenCalledWith({
        where: { menuItemId },
      });
      // No upserts should be called for empty groups
      expect(prisma.modifierGroup.upsert).not.toHaveBeenCalled();
      expect(prisma.modifierOption.upsert).not.toHaveBeenCalled();
      expect(prisma.menuItemModifierGroup.create).not.toHaveBeenCalled();
    });

    it("should soft-delete removed options", async () => {
      vi.mocked(prisma.menuItemModifierGroup.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.modifierGroup.upsert).mockResolvedValue({} as never);
      vi.mocked(prisma.modifierOption.upsert).mockResolvedValue({} as never);
      vi.mocked(prisma.modifierOption.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.menuItemModifierGroup.create).mockResolvedValue({} as never);

      // Pass a group with only one modifier — any previously existing ones should be soft-deleted
      const groups = [
        {
          id: "mg-size",
          name: "Size",
          type: "single" as const,
          required: true,
          modifiers: [{ id: "mod-small", name: "Small", price: 0 }],
        },
      ];

      await menuService.syncModifierGroups(tenantId, menuItemId, groups);

      expect(prisma.modifierOption.updateMany).toHaveBeenCalledWith({
        where: {
          groupId: "mg-size",
          id: { notIn: ["mod-small"] },
          deleted: false,
        },
        data: { deleted: true },
      });
    });
  });
});
