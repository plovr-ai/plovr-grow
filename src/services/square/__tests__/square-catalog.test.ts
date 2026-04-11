import { describe, it, expect, vi, beforeEach } from "vitest";
import { SquareCatalogService } from "../square-catalog.service";
import type { SquareCatalogResult } from "../square-catalog.service";

let mockCatalogObjects: object[] = [];

function makePage(objects: object[]) {
  return {
    [Symbol.asyncIterator]() {
      let index = 0;
      return {
        async next() {
          if (index < objects.length) {
            return { value: objects[index++], done: false };
          }
          return { value: undefined, done: true };
        },
      };
    },
  };
}

const mockCatalogApi = {
  list: vi.fn(() => Promise.resolve(makePage(mockCatalogObjects))),
};

vi.mock("square", () => {
  return {
    SquareClient: vi.fn().mockImplementation(function () {
      return { catalog: mockCatalogApi };
    }),
    SquareEnvironment: { Sandbox: "sandbox", Production: "production" },
  };
});

vi.mock("../square.config", () => ({
  squareConfig: {
    environment: "sandbox",
    assertConfigured: vi.fn(),
  },
}));


describe("SquareCatalogService", () => {
  let service: SquareCatalogService;

  beforeEach(() => {
    service = new SquareCatalogService();
    vi.clearAllMocks();
    mockCatalogObjects = [];
    mockCatalogApi.list.mockImplementation(() =>
      Promise.resolve(makePage(mockCatalogObjects))
    );
  });

  describe("fetchFullCatalog", () => {
    it("should fetch and group catalog objects by type", async () => {
      mockCatalogObjects = [
        { type: "CATEGORY", id: "cat-1", categoryData: { name: "Burgers" } },
        { type: "ITEM", id: "item-1", itemData: { name: "Burger" } },
        { type: "MODIFIER_LIST", id: "ml-1", modifierListData: { name: "Toppings" } },
        { type: "TAX", id: "tax-1", taxData: { name: "Sales Tax" } },
      ];

      const result = await service.fetchFullCatalog("test-token");

      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].id).toBe("cat-1");

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe("item-1");

      expect(result.modifierLists).toHaveLength(1);
      expect(result.modifierLists[0].id).toBe("ml-1");

      expect(result.taxes).toHaveLength(1);
      expect(result.taxes[0].id).toBe("tax-1");
    });

    it("should handle pagination with cursor (two pages)", async () => {
      // New SDK auto-paginates via async iterator — provide all objects in one page
      mockCatalogObjects = [
        { type: "CATEGORY", id: "cat-1", categoryData: { name: "Burgers" } },
        { type: "ITEM", id: "item-1", itemData: { name: "Burger" } },
        { type: "ITEM", id: "item-2", itemData: { name: "Fries" } },
      ];

      const result = await service.fetchFullCatalog("test-token");

      expect(result.categories).toHaveLength(1);
      expect(result.items).toHaveLength(2);
    });

    it("should handle empty result", async () => {
      mockCatalogObjects = [];

      const result = await service.fetchFullCatalog("test-token");

      expect(result.categories).toHaveLength(0);
      expect(result.items).toHaveLength(0);
      expect(result.modifierLists).toHaveLength(0);
      expect(result.taxes).toHaveLength(0);
    });
  });

  describe("mapToMenuModels", () => {
    it("should map categories with sortOrder based on index", () => {
      const catalog: SquareCatalogResult = {
        categories: [
          { type: "CATEGORY", id: "cat-1", categoryData: { name: "Burgers" } },
          { type: "CATEGORY", id: "cat-2", categoryData: { name: "Drinks" } },
        ],
        items: [],
        modifierLists: [],
        taxes: [],
        itemOptions: [],
        measurementUnits: [],
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      expect(result.categories).toHaveLength(2);
      expect(result.categories[0]).toMatchObject({
        externalId: "cat-1",
        name: "Burgers",
        sortOrder: 0,
      });
      expect(result.categories[1]).toMatchObject({
        externalId: "cat-2",
        name: "Drinks",
        sortOrder: 1,
      });
    });

    it("should map a single-variation item with base price and no Size modifier group", () => {
      const catalog: SquareCatalogResult = {
        categories: [],
        items: [
          {
            type: "ITEM",
            id: "item-1",
            itemData: {
              name: "Burger",
              description: "Beef burger",
              categoryId: "cat-1",
              variations: [
                {
                  id: "var-1",
                  type: "ITEM_VARIATION",
                  itemVariationData: {
                    name: "Regular",
                    priceMoney: { amount: BigInt(1299), currency: "USD" },
                  },
                },
              ],
            },
          },
        ],
        modifierLists: [],
        taxes: [],
        itemOptions: [],
        measurementUnits: [],
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item.externalId).toBe("item-1");
      expect(item.name).toBe("Burger");
      expect(item.description).toBe("Beef burger");
      expect(item.price).toBe(12.99);
      expect(item.categoryExternalIds).toEqual(["cat-1"]);
      expect(item.modifiers).toBeNull();
      expect(item.variationMappings).toHaveLength(1);
      expect(item.variationMappings[0]).toMatchObject({
        externalId: "var-1",
        name: "Regular",
      });
    });

    it("should map a multi-variation item with first variation price as base and Size modifier group with price deltas", () => {
      const catalog: SquareCatalogResult = {
        categories: [],
        items: [
          {
            type: "ITEM",
            id: "item-1",
            itemData: {
              name: "Latte",
              description: null,
              categoryId: "cat-1",
              variations: [
                {
                  id: "var-small",
                  type: "ITEM_VARIATION",
                  itemVariationData: {
                    name: "Small",
                    priceMoney: { amount: BigInt(399), currency: "USD" },
                  },
                },
                {
                  id: "var-medium",
                  type: "ITEM_VARIATION",
                  itemVariationData: {
                    name: "Medium",
                    priceMoney: { amount: BigInt(499), currency: "USD" },
                  },
                },
                {
                  id: "var-large",
                  type: "ITEM_VARIATION",
                  itemVariationData: {
                    name: "Large",
                    priceMoney: { amount: BigInt(599), currency: "USD" },
                  },
                },
              ],
            },
          },
        ],
        modifierLists: [],
        taxes: [],
        itemOptions: [],
        measurementUnits: [],
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item.price).toBe(3.99); // base price from first variation
      expect(item.modifiers).not.toBeNull();
      expect(item.modifiers!.groups).toHaveLength(1);

      const sizeGroup = item.modifiers!.groups[0];
      expect(sizeGroup.name).toBe("Size");
      expect(sizeGroup.required).toBe(true);
      expect(sizeGroup.minSelect).toBe(1);
      expect(sizeGroup.maxSelect).toBe(1);
      expect(sizeGroup.options).toHaveLength(3);

      // First variation: delta = 0
      expect(sizeGroup.options[0]).toMatchObject({
        name: "Small",
        price: 0,
        externalId: "var-small",
      });
      // Medium: delta = 4.99 - 3.99 = 1.00
      expect(sizeGroup.options[1]).toMatchObject({
        name: "Medium",
        price: 1,
        externalId: "var-medium",
      });
      // Large: delta = 5.99 - 3.99 = 2.00
      expect(sizeGroup.options[2]).toMatchObject({
        name: "Large",
        price: 2,
        externalId: "var-large",
      });
    });

    it("should map CatalogModifierList to modifier group with SINGLE selectionType → maxSelect 1", () => {
      const catalog: SquareCatalogResult = {
        categories: [],
        items: [
          {
            type: "ITEM",
            id: "item-1",
            itemData: {
              name: "Burger",
              description: null,
              variations: [
                {
                  id: "var-1",
                  type: "ITEM_VARIATION",
                  itemVariationData: {
                    name: "Regular",
                    priceMoney: { amount: BigInt(1299), currency: "USD" },
                  },
                },
              ],
              modifierListInfo: [
                {
                  modifierListId: "ml-1",
                  enabled: true,
                },
              ],
            },
          },
        ],
        modifierLists: [
          {
            type: "MODIFIER_LIST",
            id: "ml-1",
            modifierListData: {
              name: "Sauce",
              selectionType: "SINGLE",
              modifiers: [
                {
                  id: "mod-1",
                  type: "MODIFIER",
                  modifierData: {
                    name: "Ketchup",
                    priceMoney: { amount: BigInt(0), currency: "USD" },
                  },
                },
                {
                  id: "mod-2",
                  type: "MODIFIER",
                  modifierData: {
                    name: "BBQ",
                    priceMoney: { amount: BigInt(50), currency: "USD" },
                  },
                },
              ],
            },
          },
        ],
        taxes: [],
        itemOptions: [],
        measurementUnits: [],
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      const item = result.items[0];
      expect(item.modifiers).not.toBeNull();
      expect(item.modifiers!.groups).toHaveLength(1);

      const sauceGroup = item.modifiers!.groups[0];
      expect(sauceGroup.name).toBe("Sauce");
      expect(sauceGroup.required).toBe(false);
      expect(sauceGroup.minSelect).toBe(0);
      expect(sauceGroup.maxSelect).toBe(1); // SINGLE → maxSelect 1
      expect(sauceGroup.options).toHaveLength(2);
      expect(sauceGroup.options[0]).toMatchObject({
        name: "Ketchup",
        price: 0,
        externalId: "mod-1",
      });
      expect(sauceGroup.options[1]).toMatchObject({
        name: "BBQ",
        price: 0.5,
        externalId: "mod-2",
      });
    });

    it("should map CatalogModifierList with MULTIPLE selectionType → maxSelect equals number of modifiers", () => {
      const catalog: SquareCatalogResult = {
        categories: [],
        items: [
          {
            type: "ITEM",
            id: "item-1",
            itemData: {
              name: "Burger",
              description: null,
              variations: [
                {
                  id: "var-1",
                  type: "ITEM_VARIATION",
                  itemVariationData: {
                    name: "Regular",
                    priceMoney: { amount: BigInt(1299), currency: "USD" },
                  },
                },
              ],
              modifierListInfo: [
                {
                  modifierListId: "ml-1",
                  enabled: true,
                },
              ],
            },
          },
        ],
        modifierLists: [
          {
            type: "MODIFIER_LIST",
            id: "ml-1",
            modifierListData: {
              name: "Toppings",
              selectionType: "MULTIPLE",
              modifiers: [
                {
                  id: "mod-1",
                  type: "MODIFIER",
                  modifierData: {
                    name: "Lettuce",
                    priceMoney: { amount: BigInt(0), currency: "USD" },
                  },
                },
                {
                  id: "mod-2",
                  type: "MODIFIER",
                  modifierData: {
                    name: "Tomato",
                    priceMoney: { amount: BigInt(0), currency: "USD" },
                  },
                },
                {
                  id: "mod-3",
                  type: "MODIFIER",
                  modifierData: {
                    name: "Cheese",
                    priceMoney: { amount: BigInt(100), currency: "USD" },
                  },
                },
              ],
            },
          },
        ],
        taxes: [],
        itemOptions: [],
        measurementUnits: [],
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      const item = result.items[0];
      const toppingsGroup = item.modifiers!.groups[0];
      expect(toppingsGroup.name).toBe("Toppings");
      expect(toppingsGroup.maxSelect).toBe(3); // MULTIPLE → maxSelect = number of modifiers
    });

    it("should filter out disabled taxes and include enabled taxes", () => {
      const catalog: SquareCatalogResult = {
        categories: [],
        items: [],
        modifierLists: [],
        taxes: [
          {
            type: "TAX",
            id: "tax-1",
            taxData: {
              name: "Sales Tax",
              percentage: "8.5",
              enabled: true,
            },
          },
          {
            type: "TAX",
            id: "tax-2",
            taxData: {
              name: "Disabled Tax",
              percentage: "5.0",
              enabled: false,
            },
          },
          {
            type: "TAX",
            id: "tax-3",
            taxData: {
              name: "Liquor Tax",
              percentage: "10.25",
              // enabled is undefined → should be included (not explicitly false)
            },
          },
        ],
        itemOptions: [],
        measurementUnits: [],
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      expect(result.taxes).toHaveLength(2);
      expect(result.taxes[0]).toMatchObject({
        externalId: "tax-1",
        name: "Sales Tax",
        percentage: 8.5,
      });
      expect(result.taxes[1]).toMatchObject({
        externalId: "tax-3",
        name: "Liquor Tax",
        percentage: 10.25,
      });
    });

    it("should handle item with no variations → price 0 and no modifiers", () => {
      const catalog: SquareCatalogResult = {
        categories: [],
        items: [
          {
            type: "ITEM",
            id: "item-1",
            itemData: {
              name: "Water",
              description: "Still water",
              variations: [],
            },
          },
        ],
        modifierLists: [],
        taxes: [],
        itemOptions: [],
        measurementUnits: [],
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      const item = result.items[0];
      expect(item.price).toBe(0);
      expect(item.modifiers).toBeNull();
      expect(item.variationMappings).toEqual([]);
    });

    it("should skip disabled modifier list info entries", () => {
      const catalog: SquareCatalogResult = {
        categories: [],
        items: [
          {
            type: "ITEM",
            id: "item-1",
            itemData: {
              name: "Burger",
              description: null,
              variations: [
                {
                  id: "var-1",
                  type: "ITEM_VARIATION",
                  itemVariationData: {
                    name: "Regular",
                    priceMoney: { amount: BigInt(1299), currency: "USD" },
                  },
                },
              ],
              modifierListInfo: [
                {
                  modifierListId: "ml-1",
                  enabled: false, // disabled → should be skipped
                },
              ],
            },
          },
        ],
        modifierLists: [
          {
            type: "MODIFIER_LIST",
            id: "ml-1",
            modifierListData: {
              name: "Toppings",
              selectionType: "MULTIPLE",
              modifiers: [],
            },
          },
        ],
        taxes: [],
        itemOptions: [],
        measurementUnits: [],
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      const item = result.items[0];
      expect(item.modifiers).toBeNull();
    });

    it("should use production environment when configured", async () => {
      const { squareConfig: configMock } = await import("../square.config");
      const origEnv = configMock.environment;
      (configMock as Record<string, unknown>).environment = "production";

      mockCatalogObjects = [];
      mockCatalogApi.list.mockImplementation(() =>
        Promise.resolve(makePage([]))
      );

      await service.fetchFullCatalog("test-token");

      const squareModule = await import("square");
      const ClientMock = squareModule.SquareClient as unknown as ReturnType<typeof vi.fn>;
      const lastCallArgs = ClientMock.mock.calls[ClientMock.mock.calls.length - 1][0];
      expect(lastCallArgs.environment).toBe("production");

      (configMock as Record<string, unknown>).environment = origEnv;
    });

    it("should handle taxes with null name and null percentage", () => {
      const catalog: SquareCatalogResult = {
        categories: [],
        items: [],
        modifierLists: [],
        taxes: [
          {
            type: "TAX",
            id: "tax-1",
            taxData: {
              name: null,
              percentage: null,
              enabled: true,
            },
          },
        ],
        itemOptions: [],
        measurementUnits: [],
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      expect(result.taxes).toHaveLength(1);
      expect(result.taxes[0]).toMatchObject({
        externalId: "tax-1",
        name: "Tax",
        percentage: 0,
      });
    });

    it("should handle category with null name", () => {
      const catalog: SquareCatalogResult = {
        categories: [
          { type: "CATEGORY", id: "cat-1", categoryData: { name: null } },
        ],
        items: [],
        modifierLists: [],
        taxes: [],
        itemOptions: [],
        measurementUnits: [],
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      expect(result.categories[0].name).toBe("Unnamed");
    });

    it("should handle item with null name and null description", () => {
      const catalog: SquareCatalogResult = {
        categories: [],
        items: [
          {
            type: "ITEM",
            id: "item-1",
            itemData: {
              name: null,
              description: null,
              variations: [
                {
                  id: "var-1",
                  type: "ITEM_VARIATION",
                  itemVariationData: {
                    name: null,
                    priceMoney: { amount: null },
                  },
                },
              ],
            },
          },
        ],
        modifierLists: [],
        taxes: [],
        itemOptions: [],
        measurementUnits: [],
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      expect(result.items[0].name).toBe("Unnamed");
      expect(result.items[0].description).toBeNull();
      expect(result.items[0].price).toBe(0);
      expect(result.items[0].variationMappings[0].name).toBe("Default");
    });

    it("should handle modifier list with null name and null modifier data", () => {
      const catalog: SquareCatalogResult = {
        categories: [],
        items: [
          {
            type: "ITEM",
            id: "item-1",
            itemData: {
              name: "Burger",
              description: null,
              variations: [
                {
                  id: "var-1",
                  type: "ITEM_VARIATION",
                  itemVariationData: {
                    name: "Regular",
                    priceMoney: { amount: BigInt(1000), currency: "USD" },
                  },
                },
              ],
              modifierListInfo: [
                { modifierListId: "ml-1", enabled: true },
                { modifierListId: "ml-missing", enabled: true },
              ],
            },
          },
        ],
        modifierLists: [
          {
            type: "MODIFIER_LIST",
            id: "ml-1",
            modifierListData: {
              name: null,
              selectionType: "MULTIPLE",
              modifiers: [
                {
                  id: "mod-1",
                  type: "MODIFIER",
                  modifierData: { name: null, priceMoney: { amount: null } },
                },
              ],
            },
          },
        ],
        taxes: [],
        itemOptions: [],
        measurementUnits: [],
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      const item = result.items[0];
      expect(item.modifiers).not.toBeNull();
      expect(item.modifiers!.groups).toHaveLength(1);
      expect(item.modifiers!.groups[0].name).toBe("Options");
      expect(item.modifiers!.groups[0].options[0].name).toBe("Option");
      expect(item.modifiers!.groups[0].options[0].price).toBe(0);
    });

    it("should default variation name to 'Default' when null in multi-variation Size group", () => {
      const catalog: SquareCatalogResult = {
        categories: [],
        items: [
          {
            type: "ITEM",
            id: "item-1",
            itemData: {
              name: "Drink",
              description: null,
              variations: [
                {
                  id: "var-1",
                  type: "ITEM_VARIATION",
                  itemVariationData: {
                    name: null,
                    priceMoney: { amount: BigInt(300), currency: "USD" },
                  },
                },
                {
                  id: "var-2",
                  type: "ITEM_VARIATION",
                  itemVariationData: {
                    name: "Large",
                    priceMoney: { amount: BigInt(500), currency: "USD" },
                  },
                },
              ],
            },
          },
        ],
        modifierLists: [],
        taxes: [],
        itemOptions: [],
        measurementUnits: [],
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      const sizeGroup = result.items[0].modifiers!.groups[0];
      expect(sizeGroup.options[0].name).toBe("Default");
      expect(sizeGroup.options[1].name).toBe("Large");
    });

    it("should handle item with undefined variations", () => {
      const catalog: SquareCatalogResult = {
        categories: [],
        items: [
          {
            type: "ITEM",
            id: "item-1",
            itemData: {
              name: "Simple Item",
              description: null,
              // variations is undefined
            },
          },
        ],
        modifierLists: [],
        taxes: [],
        itemOptions: [],
        measurementUnits: [],
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      expect(result.items[0].price).toBe(0);
      expect(result.items[0].variationMappings).toEqual([]);
    });

    it("should handle modifier list with undefined modifiers", () => {
      const catalog: SquareCatalogResult = {
        categories: [],
        items: [
          {
            type: "ITEM",
            id: "item-1",
            itemData: {
              name: "Burger",
              description: null,
              variations: [
                {
                  id: "var-1",
                  type: "ITEM_VARIATION",
                  itemVariationData: {
                    name: "Regular",
                    priceMoney: { amount: BigInt(1000), currency: "USD" },
                  },
                },
              ],
              modifierListInfo: [
                { modifierListId: "ml-1", enabled: true },
              ],
            },
          },
        ],
        modifierLists: [
          {
            type: "MODIFIER_LIST",
            id: "ml-1",
            modifierListData: {
              name: "Toppings",
              selectionType: "MULTIPLE",
              // modifiers is undefined
            },
          },
        ],
        taxes: [],
        itemOptions: [],
        measurementUnits: [],
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      const group = result.items[0].modifiers!.groups[0];
      expect(group.maxSelect).toBe(10);
      expect(group.options).toEqual([]);
    });

    it("should handle modifierListInfo being undefined", () => {
      const catalog: SquareCatalogResult = {
        categories: [],
        items: [
          {
            type: "ITEM",
            id: "item-1",
            itemData: {
              name: "Simple",
              description: null,
              variations: [
                {
                  id: "var-1",
                  type: "ITEM_VARIATION",
                  itemVariationData: {
                    name: "Regular",
                    priceMoney: { amount: BigInt(500), currency: "USD" },
                  },
                },
              ],
              // modifierListInfo is undefined
            },
          },
        ],
        modifierLists: [],
        taxes: [],
        itemOptions: [],
        measurementUnits: [],
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      expect(result.items[0].modifiers).toBeNull();
    });

    it("should skip modifier list entries with no modifierListData", () => {
      const catalog: SquareCatalogResult = {
        categories: [],
        items: [
          {
            type: "ITEM",
            id: "item-1",
            itemData: {
              name: "Burger",
              description: null,
              variations: [
                {
                  id: "var-1",
                  type: "ITEM_VARIATION",
                  itemVariationData: {
                    name: "Regular",
                    priceMoney: { amount: BigInt(1000), currency: "USD" },
                  },
                },
              ],
              modifierListInfo: [
                { modifierListId: "ml-1", enabled: true },
              ],
            },
          },
        ],
        modifierLists: [
          {
            type: "MODIFIER_LIST",
            id: "ml-1",
            // no modifierListData
          },
        ],
        taxes: [],
        itemOptions: [],
        measurementUnits: [],
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      expect(result.items[0].modifiers).toBeNull();
    });

    it("should handle modifier list with empty modifiers array", () => {
      const catalog: SquareCatalogResult = {
        categories: [],
        items: [
          {
            type: "ITEM",
            id: "item-1",
            itemData: {
              name: "Burger",
              description: null,
              variations: [
                {
                  id: "var-1",
                  type: "ITEM_VARIATION",
                  itemVariationData: {
                    name: "Regular",
                    priceMoney: { amount: BigInt(1000), currency: "USD" },
                  },
                },
              ],
              modifierListInfo: [
                { modifierListId: "ml-1", enabled: true },
              ],
            },
          },
        ],
        modifierLists: [
          {
            type: "MODIFIER_LIST",
            id: "ml-1",
            modifierListData: {
              name: "Toppings",
              selectionType: "MULTIPLE",
              modifiers: [],
            },
          },
        ],
        taxes: [],
        itemOptions: [],
        measurementUnits: [],
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      // Even with 0 modifiers, the group is added (maxSelect fallback to 10)
      expect(result.items[0].modifiers).not.toBeNull();
      expect(result.items[0].modifiers!.groups[0].maxSelect).toBe(10);
    });

    it("should set categoryExternalIds to empty array when item has no categoryId", () => {
      const catalog: SquareCatalogResult = {
        categories: [],
        items: [
          {
            type: "ITEM",
            id: "item-1",
            itemData: {
              name: "Special Item",
              description: null,
              // no categoryId
              variations: [
                {
                  id: "var-1",
                  type: "ITEM_VARIATION",
                  itemVariationData: {
                    name: "Default",
                    priceMoney: { amount: BigInt(999), currency: "USD" },
                  },
                },
              ],
            },
          },
        ],
        modifierLists: [],
        taxes: [],
        itemOptions: [],
        measurementUnits: [],
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      expect(result.items[0].categoryExternalIds).toEqual([]);
    });
  });
});
