import { describe, it, expect, vi, beforeEach } from "vitest";
import { SquareCatalogService } from "../square-catalog.service";
import type { SquareCatalogResult } from "../square-catalog.service";
import type { CatalogObject } from "square";

function buildModifier(id: string, name: string, amountCents: number, ordinal: number): CatalogObject {
  return {
    type: "MODIFIER",
    id,
    modifierData: {
      name,
      ordinal,
      priceMoney: { amount: BigInt(amountCents), currency: "USD" },
    },
  } as CatalogObject;
}

function buildModifierList(
  id: string,
  name: string,
  selectionType: "SINGLE" | "MULTIPLE",
  minSelected: number,
  maxSelected: number | null,
  modifiers: CatalogObject[]
): CatalogObject {
  return {
    type: "MODIFIER_LIST",
    id,
    modifierListData: {
      name,
      selectionType,
      minSelectedModifiers: minSelected,
      maxSelectedModifiers: maxSelected,
      modifiers,
    },
  } as CatalogObject;
}

function buildVariation(id: string, name: string, amountCents: number, ordinal: number): CatalogObject {
  return {
    type: "ITEM_VARIATION",
    id,
    itemVariationData: {
      name,
      ordinal,
      pricingType: "FIXED_PRICING",
      priceMoney: { amount: BigInt(amountCents), currency: "USD" },
    },
  } as CatalogObject;
}

function buildItem(id: string, name: string, variations: CatalogObject[], extra: Partial<Record<string, unknown>> = {}): CatalogObject {
  return {
    type: "ITEM",
    id,
    itemData: {
      name,
      productType: "REGULAR",
      variations,
      ...extra,
    },
  } as CatalogObject;
}

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
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      expect(result.categories).toHaveLength(2);
      expect(result.categories[0]).toEqual({
        externalId: "cat-1",
        name: "Burgers",
        sortOrder: 0,
      });
      expect(result.categories[1]).toEqual({
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
      expect(item.variationMappings).toEqual([
        { externalId: "var-1", name: "Regular" },
      ]);
    });

    it("should map a multi-variation item with min variation price as base and Options modifier group with price deltas", () => {
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
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item.price).toBe(3.99); // base price = min variation price (Small)
      expect(item.modifiers).not.toBeNull();
      expect(item.modifiers!.groups).toHaveLength(1);

      const sizeGroup = item.modifiers!.groups[0];
      expect(sizeGroup.name).toBe("Options");
      expect(sizeGroup.required).toBe(true);
      expect(sizeGroup.minSelect).toBe(1);
      expect(sizeGroup.maxSelect).toBe(1);
      expect(sizeGroup.options).toHaveLength(3);

      // First variation (min price): delta = 0, isDefault = true
      expect(sizeGroup.options[0]).toEqual({
        name: "Small",
        price: 0,
        externalId: "var-small",
        isDefault: true,
        ordinal: 0,
      });
      // Medium: delta = 4.99 - 3.99 = 1.00
      expect(sizeGroup.options[1]).toEqual({
        name: "Medium",
        price: 1,
        externalId: "var-medium",
        isDefault: false,
        ordinal: 1,
      });
      // Large: delta = 5.99 - 3.99 = 2.00
      expect(sizeGroup.options[2]).toEqual({
        name: "Large",
        price: 2,
        externalId: "var-large",
        isDefault: false,
        ordinal: 2,
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
      expect(sauceGroup.options[0]).toEqual({
        name: "Ketchup",
        price: 0,
        externalId: "mod-1",
        isDefault: false,
        ordinal: 0,
      });
      expect(sauceGroup.options[1]).toEqual({
        name: "BBQ",
        price: 0.5,
        externalId: "mod-2",
        isDefault: false,
        ordinal: 1,
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
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      expect(result.taxes).toHaveLength(2);
      expect(result.taxes[0]).toEqual({
        externalId: "tax-1",
        name: "Sales Tax",
        percentage: 8.5,
        inclusionType: "additive",
      });
      expect(result.taxes[1]).toEqual({
        externalId: "tax-3",
        name: "Liquor Tax",
        percentage: 10.25,
        inclusionType: "additive",
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
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      expect(result.taxes).toHaveLength(1);
      expect(result.taxes[0]).toEqual({
        externalId: "tax-1",
        name: "Tax",
        percentage: 0,
        inclusionType: "additive",
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
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      const optionsGroup = result.items[0].modifiers!.groups[0];
      expect(optionsGroup.options[0].name).toBe("Default");
      expect(optionsGroup.options[1].name).toBe("Large");
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
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      const group = result.items[0].modifiers!.groups[0];
      expect(group.maxSelect).toBe(0);
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
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      // Even with 0 modifiers, the group is added (maxSelect = 0 under new semantics)
      expect(result.items[0].modifiers).not.toBeNull();
      expect(result.items[0].modifiers!.groups[0].maxSelect).toBe(0);
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
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      expect(result.items[0].categoryExternalIds).toEqual([]);
    });

    describe("variation → modifier group mapping (TDD Task 10)", () => {
      it("single variation maps 1:1 without injecting a modifier group", () => {
        const catalog: SquareCatalogResult = {
          categories: [], modifierLists: [], taxes: [], images: [],
          items: [buildItem("item-1", "Latte", [buildVariation("var-1", "Regular", 500, 0)])],
        };
        const result = service.mapToMenuModels(catalog);
        expect(result.items).toHaveLength(1);
        expect(result.items[0].price).toBe(5.0);
        expect(result.items[0].modifiers).toBeNull();
        expect(result.items[0].variationMappings).toEqual([
          { externalId: "var-1", name: "Regular" },
        ]);
      });

      it("multi-variation injects single-select required group with base=min", () => {
        const catalog: SquareCatalogResult = {
          categories: [], modifierLists: [], taxes: [], images: [],
          items: [buildItem("item-1", "Coffee", [
            buildVariation("v-s", "Small",  300, 0),
            buildVariation("v-m", "Medium", 400, 1),
            buildVariation("v-l", "Large",  500, 2),
          ])],
        };
        const result = service.mapToMenuModels(catalog);
        expect(result.items[0].price).toBe(3.0); // base = min price
        expect(result.items[0].modifiers?.groups).toHaveLength(1);
        const group = result.items[0].modifiers!.groups[0];
        expect(group.name).toBe("Options");
        expect(group.required).toBe(true);
        expect(group.minSelect).toBe(1);
        expect(group.maxSelect).toBe(1);
        expect(group.options).toHaveLength(3);
        expect(group.options.map((o) => [o.name, o.price, o.isDefault])).toEqual([
          ["Small",  0, true],
          ["Medium", 1, false],
          ["Large",  2, false],
        ]);
      });

      it("sorts variations by ordinal regardless of array order", () => {
        const catalog: SquareCatalogResult = {
          categories: [], modifierLists: [], taxes: [], images: [],
          items: [buildItem("item-1", "Coffee", [
            buildVariation("v-l", "Large",  500, 2),
            buildVariation("v-s", "Small",  300, 0),
            buildVariation("v-m", "Medium", 400, 1),
          ])],
        };
        const result = service.mapToMenuModels(catalog);
        const names = result.items[0].modifiers!.groups[0].options.map((o) => o.name);
        expect(names).toEqual(["Small", "Medium", "Large"]);
        expect(result.items[0].price).toBe(3.0);
      });

      it("stores groupId/optionId on variationMappings for multi-variation item", () => {
        const catalog: SquareCatalogResult = {
          categories: [], modifierLists: [], taxes: [], images: [],
          items: [buildItem("item-1", "Coffee", [
            buildVariation("v-s", "Small", 300, 0),
            buildVariation("v-l", "Large", 500, 1),
          ])],
        };
        const result = service.mapToMenuModels(catalog);
        expect(result.items[0].variationMappings).toHaveLength(2);
        for (const m of result.items[0].variationMappings) {
          expect(m.groupId).toBeDefined();
          expect(m.optionId).toBeDefined();
        }
        // groupId should be consistent across all variations of the same item
        const gids = result.items[0].variationMappings.map((m) => m.groupId);
        expect(new Set(gids).size).toBe(1);
      });

      it("does not populate groupId/optionId on single-variation item", () => {
        const catalog: SquareCatalogResult = {
          categories: [], modifierLists: [], taxes: [], images: [],
          items: [buildItem("item-1", "Latte", [buildVariation("var-1", "Regular", 500, 0)])],
        };
        const result = service.mapToMenuModels(catalog);
        expect(result.items[0].variationMappings[0].groupId).toBeUndefined();
        expect(result.items[0].variationMappings[0].optionId).toBeUndefined();
      });
    });

    describe("ModifierList → group mapping (TDD Task 11)", () => {
      it("maps SINGLE + min=1 to required single-select group", () => {
        const ml = buildModifierList("ml-1", "Sauce", "SINGLE", 1, 1, [
          buildModifier("mod-1", "Ketchup",  0,   0),
          buildModifier("mod-2", "Mustard", 50,   1),
        ]);
        const item = buildItem("item-1", "Burger", [buildVariation("v-1", "Regular", 500, 0)], {
          modifierListInfo: [{ modifierListId: "ml-1", enabled: true }],
        });
        const result = service.mapToMenuModels({
          categories: [], modifierLists: [ml], taxes: [], images: [], items: [item],
        });
        const groups = result.items[0].modifiers!.groups;
        expect(groups).toHaveLength(1);
        expect(groups[0]).toMatchObject({
          name: "Sauce",
          required: true,
          minSelect: 1,
          maxSelect: 1,
        });
        expect(groups[0].options.map((o) => [o.name, o.price])).toEqual([
          ["Ketchup", 0],
          ["Mustard", 0.5],
        ]);
      });

      it("maps MULTIPLE + min=0 to optional multi-select group", () => {
        const ml = buildModifierList("ml-1", "Toppings", "MULTIPLE", 0, 3, [
          buildModifier("mod-1", "Cheese",  100, 0),
          buildModifier("mod-2", "Bacon",   150, 1),
          buildModifier("mod-3", "Avocado", 200, 2),
        ]);
        const item = buildItem("item-1", "Burger", [buildVariation("v-1", "R", 500, 0)], {
          modifierListInfo: [{ modifierListId: "ml-1", enabled: true }],
        });
        const result = service.mapToMenuModels({
          categories: [], modifierLists: [ml], taxes: [], images: [], items: [item],
        });
        const group = result.items[0].modifiers!.groups[0];
        expect(group).toMatchObject({
          name: "Toppings",
          required: false,
          minSelect: 0,
          maxSelect: 3,
        });
      });

      it("skips modifier list info when enabled is false", () => {
        const ml = buildModifierList("ml-1", "Sauce", "SINGLE", 1, 1, [
          buildModifier("mod-1", "Ketchup", 0, 0),
        ]);
        const item = buildItem("item-1", "Burger", [buildVariation("v-1", "R", 500, 0)], {
          modifierListInfo: [{ modifierListId: "ml-1", enabled: false }],
        });
        const result = service.mapToMenuModels({
          categories: [], modifierLists: [ml], taxes: [], images: [], items: [item],
        });
        // Item is single-variation, no variation group, and modifier list is disabled → no groups at all
        expect(result.items[0].modifiers).toBeNull();
      });

      it("sorts modifiers by ordinal regardless of array order", () => {
        const ml = buildModifierList("ml-1", "Sauce", "SINGLE", 1, 1, [
          buildModifier("mod-b", "Mustard", 50, 1),
          buildModifier("mod-a", "Ketchup", 0,  0),
        ]);
        const item = buildItem("item-1", "Burger", [buildVariation("v-1", "R", 500, 0)], {
          modifierListInfo: [{ modifierListId: "ml-1", enabled: true }],
        });
        const result = service.mapToMenuModels({
          categories: [], modifierLists: [ml], taxes: [], images: [], items: [item],
        });
        const names = result.items[0].modifiers!.groups[0].options.map((o) => o.name);
        expect(names).toEqual(["Ketchup", "Mustard"]);
      });
    });
  });
});
