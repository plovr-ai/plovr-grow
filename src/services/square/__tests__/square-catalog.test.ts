import { describe, it, expect, vi, beforeEach } from "vitest";
import { SquareCatalogService } from "../square-catalog.service";
import type { SquareCatalogResult } from "../square-catalog.service";

const mockCatalogApi = { listCatalog: vi.fn() };

vi.mock("square", () => {
  return {
    Client: vi.fn().mockImplementation(function () {
      return { catalogApi: mockCatalogApi };
    }),
    Environment: { Sandbox: "sandbox", Production: "production" },
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
  });

  describe("fetchFullCatalog", () => {
    it("should fetch and group catalog objects by type", async () => {
      mockCatalogApi.listCatalog.mockResolvedValueOnce({
        result: {
          objects: [
            { type: "CATEGORY", id: "cat-1", categoryData: { name: "Burgers" } },
            { type: "ITEM", id: "item-1", itemData: { name: "Burger" } },
            {
              type: "MODIFIER_LIST",
              id: "ml-1",
              modifierListData: { name: "Toppings" },
            },
            { type: "TAX", id: "tax-1", taxData: { name: "Sales Tax" } },
          ],
          cursor: undefined,
        },
      });

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
      // First page returns a cursor
      mockCatalogApi.listCatalog.mockResolvedValueOnce({
        result: {
          objects: [
            { type: "CATEGORY", id: "cat-1", categoryData: { name: "Burgers" } },
          ],
          cursor: "page-2-cursor",
        },
      });

      // Second page (no cursor = last page)
      mockCatalogApi.listCatalog.mockResolvedValueOnce({
        result: {
          objects: [
            { type: "ITEM", id: "item-1", itemData: { name: "Burger" } },
            { type: "ITEM", id: "item-2", itemData: { name: "Fries" } },
          ],
          cursor: undefined,
        },
      });

      const result = await service.fetchFullCatalog("test-token");

      expect(mockCatalogApi.listCatalog).toHaveBeenCalledTimes(2);
      expect(mockCatalogApi.listCatalog).toHaveBeenNthCalledWith(1, undefined);
      expect(mockCatalogApi.listCatalog).toHaveBeenNthCalledWith(2, "page-2-cursor");

      expect(result.categories).toHaveLength(1);
      expect(result.items).toHaveLength(2);
    });

    it("should handle empty result", async () => {
      mockCatalogApi.listCatalog.mockResolvedValueOnce({
        result: { objects: undefined, cursor: undefined },
      });

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
      expect(sizeGroup.options[0]).toEqual({
        name: "Small",
        price: 0,
        externalId: "var-small",
      });
      // Medium: delta = 4.99 - 3.99 = 1.00
      expect(sizeGroup.options[1]).toEqual({
        name: "Medium",
        price: 1,
        externalId: "var-medium",
      });
      // Large: delta = 5.99 - 3.99 = 2.00
      expect(sizeGroup.options[2]).toEqual({
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
      });
      expect(sauceGroup.options[1]).toEqual({
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
      };

      const result = service.mapToMenuModels(catalog);

      expect(result.taxes).toHaveLength(2);
      expect(result.taxes[0]).toEqual({
        externalId: "tax-1",
        name: "Sales Tax",
        percentage: 8.5,
      });
      expect(result.taxes[1]).toEqual({
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
      };

      const result = service.mapToMenuModels(catalog);

      const item = result.items[0];
      expect(item.modifiers).toBeNull();
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
      };

      const result = service.mapToMenuModels(catalog);

      expect(result.items[0].categoryExternalIds).toEqual([]);
    });
  });
});
