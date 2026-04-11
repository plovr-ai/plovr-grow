import { describe, it, expect, vi } from "vitest";
import { SquareCatalogService } from "../square-catalog.service";
import type { SquareCatalogResult } from "../square-catalog.service";

vi.mock("../square.config", () => ({
  squareConfig: { environment: "sandbox", assertConfigured: vi.fn() },
}));

describe("SquareCatalogService - mapToMenuModels comprehensive mapping", () => {
  const service = new SquareCatalogService();

  describe("full restaurant catalog", () => {
    it("should correctly map categories, items with variations, modifier lists, and taxes", () => {
      const catalog: SquareCatalogResult = {
        categories: [
          {
            type: "CATEGORY",
            id: "cat-appetizers",
            categoryData: { name: "Appetizers" },
          },
          {
            type: "CATEGORY",
            id: "cat-mains",
            categoryData: { name: "Main Courses" },
          },
        ],
        items: [
          {
            // Multi-variation item with modifier list
            type: "ITEM",
            id: "item-wings",
            itemData: {
              name: "Chicken Wings",
              description: "Crispy chicken wings",
              categoryId: "cat-appetizers",
              variations: [
                {
                  id: "var-wings-6pc",
                  type: "ITEM_VARIATION",
                  itemVariationData: {
                    name: "6pc",
                    priceMoney: { amount: BigInt(1099), currency: "USD" },
                  },
                },
                {
                  id: "var-wings-12pc",
                  type: "ITEM_VARIATION",
                  itemVariationData: {
                    name: "12pc",
                    priceMoney: { amount: BigInt(1899), currency: "USD" },
                  },
                },
              ],
              modifierListInfo: [
                {
                  modifierListId: "ml-sauce",
                  enabled: true,
                },
              ],
            },
          },
          {
            // Single-variation item with no modifiers
            type: "ITEM",
            id: "item-steak",
            itemData: {
              name: "Ribeye Steak",
              description: "12oz prime ribeye",
              categoryId: "cat-mains",
              variations: [
                {
                  id: "var-steak",
                  type: "ITEM_VARIATION",
                  itemVariationData: {
                    name: "Regular",
                    priceMoney: { amount: BigInt(3499), currency: "USD" },
                  },
                },
              ],
            },
          },
        ],
        modifierLists: [
          {
            type: "MODIFIER_LIST",
            id: "ml-sauce",
            modifierListData: {
              name: "Sauce",
              selectionType: "MULTIPLE",
              modifiers: [
                {
                  id: "mod-bbq",
                  type: "MODIFIER",
                  modifierData: {
                    name: "BBQ",
                    priceMoney: { amount: BigInt(0), currency: "USD" },
                  },
                },
                {
                  id: "mod-buffalo",
                  type: "MODIFIER",
                  modifierData: {
                    name: "Buffalo",
                    priceMoney: { amount: BigInt(0), currency: "USD" },
                  },
                },
                {
                  id: "mod-truffle",
                  type: "MODIFIER",
                  modifierData: {
                    name: "Truffle Aioli",
                    priceMoney: { amount: BigInt(150), currency: "USD" },
                  },
                },
              ],
            },
          },
        ],
        taxes: [
          {
            type: "TAX",
            id: "tax-sales",
            taxData: {
              name: "Sales Tax",
              percentage: "8.875",
              enabled: true,
            },
          },
          {
            type: "TAX",
            id: "tax-old",
            taxData: {
              name: "Old Tax",
              percentage: "5.0",
              enabled: false,
            },
          },
        ],
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      // 2 categories mapped
      expect(result.categories).toHaveLength(2);
      expect(result.categories[0]).toEqual({
        externalId: "cat-appetizers",
        name: "Appetizers",
        sortOrder: 0,
      });
      expect(result.categories[1]).toEqual({
        externalId: "cat-mains",
        name: "Main Courses",
        sortOrder: 1,
      });

      // 2 items mapped
      expect(result.items).toHaveLength(2);

      // Wings: price=10.99 (min variation price), 2 modifier groups (Options + Sauce)
      const wings = result.items[0];
      expect(wings.externalId).toBe("item-wings");
      expect(wings.name).toBe("Chicken Wings");
      expect(wings.price).toBe(10.99);
      expect(wings.categoryExternalIds).toEqual(["cat-appetizers"]);
      expect(wings.modifiers).not.toBeNull();
      expect(wings.modifiers!.groups).toHaveLength(2);

      // Options group (from multi-variation)
      const optionsGroup = wings.modifiers!.groups[0];
      expect(optionsGroup.name).toBe("Options");
      expect(optionsGroup.required).toBe(true);
      expect(optionsGroup.minSelect).toBe(1);
      expect(optionsGroup.maxSelect).toBe(1);
      expect(optionsGroup.options).toHaveLength(2);
      // First option: delta = 0 (base/min price), isDefault = true
      expect(optionsGroup.options[0]).toEqual({
        name: "6pc",
        price: 0,
        externalId: "var-wings-6pc",
        isDefault: true,
        ordinal: 0,
      });
      // Second option: delta = 18.99 - 10.99 = 8.00
      expect(optionsGroup.options[1]).toEqual({
        name: "12pc",
        price: 8,
        externalId: "var-wings-12pc",
        isDefault: false,
        ordinal: 1,
      });

      // Sauce group (MULTIPLE selection)
      const sauceGroup = wings.modifiers!.groups[1];
      expect(sauceGroup.name).toBe("Sauce");
      expect(sauceGroup.required).toBe(false);
      expect(sauceGroup.minSelect).toBe(0);
      expect(sauceGroup.maxSelect).toBe(3); // MULTIPLE → maxSelect = number of modifiers
      expect(sauceGroup.options).toHaveLength(3);
      expect(sauceGroup.options[0]).toEqual({
        name: "BBQ",
        price: 0,
        externalId: "mod-bbq",
        isDefault: false,
        ordinal: 0,
      });
      expect(sauceGroup.options[1]).toEqual({
        name: "Buffalo",
        price: 0,
        externalId: "mod-buffalo",
        isDefault: false,
        ordinal: 1,
      });
      expect(sauceGroup.options[2]).toEqual({
        name: "Truffle Aioli",
        price: 1.5,
        externalId: "mod-truffle",
        isDefault: false,
        ordinal: 2,
      });

      // Steak: price=34.99, no modifiers
      const steak = result.items[1];
      expect(steak.externalId).toBe("item-steak");
      expect(steak.name).toBe("Ribeye Steak");
      expect(steak.price).toBe(34.99);
      expect(steak.categoryExternalIds).toEqual(["cat-mains"]);
      expect(steak.modifiers).toBeNull();

      // 1 tax (disabled "Old Tax" filtered out)
      expect(result.taxes).toHaveLength(1);
      expect(result.taxes[0]).toEqual({
        externalId: "tax-sales",
        name: "Sales Tax",
        percentage: 8.875,
        inclusionType: "additive",
      });
    });
  });

  describe("item with no variations", () => {
    it("should skip item and increment itemsSkipped (Task 13 skip rule)", () => {
      const catalog: SquareCatalogResult = {
        categories: [],
        items: [
          {
            type: "ITEM",
            id: "item-special",
            itemData: {
              name: "Chef's Special",
              description: "Ask your server",
              variations: [],
            },
          },
        ],
        modifierLists: [],
        taxes: [],
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      // Items with no valid variations are now skipped
      expect(result.items).toHaveLength(0);
      expect(result.stats.itemsSkipped).toBe(1);
    });
  });

  describe("modifier list with SINGLE selection type", () => {
    it("should set maxSelect to 1", () => {
      const catalog: SquareCatalogResult = {
        categories: [],
        items: [
          {
            type: "ITEM",
            id: "item-burger",
            itemData: {
              name: "Burger",
              description: null,
              variations: [
                {
                  id: "var-burger",
                  type: "ITEM_VARIATION",
                  itemVariationData: {
                    name: "Regular",
                    priceMoney: { amount: BigInt(1299), currency: "USD" },
                  },
                },
              ],
              modifierListInfo: [
                {
                  modifierListId: "ml-doneness",
                  enabled: true,
                },
              ],
            },
          },
        ],
        modifierLists: [
          {
            type: "MODIFIER_LIST",
            id: "ml-doneness",
            modifierListData: {
              name: "Doneness",
              selectionType: "SINGLE",
              modifiers: [
                {
                  id: "mod-rare",
                  type: "MODIFIER",
                  modifierData: {
                    name: "Rare",
                    priceMoney: { amount: BigInt(0), currency: "USD" },
                  },
                },
                {
                  id: "mod-medium",
                  type: "MODIFIER",
                  modifierData: {
                    name: "Medium",
                    priceMoney: { amount: BigInt(0), currency: "USD" },
                  },
                },
                {
                  id: "mod-well",
                  type: "MODIFIER",
                  modifierData: {
                    name: "Well Done",
                    priceMoney: { amount: BigInt(0), currency: "USD" },
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

      const donenessGroup = item.modifiers!.groups[0];
      expect(donenessGroup.name).toBe("Doneness");
      expect(donenessGroup.maxSelect).toBe(1); // SINGLE → maxSelect 1
      expect(donenessGroup.options).toHaveLength(3);
    });
  });
});
