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
        itemOptions: [],
        measurementUnits: [],
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      // 2 categories mapped
      expect(result.categories).toHaveLength(2);
      expect(result.categories[0]).toMatchObject({
        externalId: "cat-appetizers",
        name: "Appetizers",
        sortOrder: 0,
      });
      expect(result.categories[1]).toMatchObject({
        externalId: "cat-mains",
        name: "Main Courses",
        sortOrder: 1,
      });

      // 2 items mapped
      expect(result.items).toHaveLength(2);

      // Wings: price=10.99, 2 modifier groups (Size + Sauce)
      const wings = result.items[0];
      expect(wings.externalId).toBe("item-wings");
      expect(wings.name).toBe("Chicken Wings");
      expect(wings.price).toBe(10.99);
      expect(wings.categoryExternalIds).toEqual(["cat-appetizers"]);
      expect(wings.modifiers).not.toBeNull();
      expect(wings.modifiers!.groups).toHaveLength(2);

      // Size group (from multi-variation)
      const sizeGroup = wings.modifiers!.groups[0];
      expect(sizeGroup.name).toBe("Size");
      expect(sizeGroup.required).toBe(true);
      expect(sizeGroup.minSelect).toBe(1);
      expect(sizeGroup.maxSelect).toBe(1);
      expect(sizeGroup.options).toHaveLength(2);
      // First option: delta = 0 (base price)
      expect(sizeGroup.options[0]).toMatchObject({
        name: "6pc",
        price: 0,
        externalId: "var-wings-6pc",
      });
      // Second option: delta = 18.99 - 10.99 = 8.00
      expect(sizeGroup.options[1]).toMatchObject({
        name: "12pc",
        price: 8,
        externalId: "var-wings-12pc",
      });

      // Sauce group (MULTIPLE selection)
      const sauceGroup = wings.modifiers!.groups[1];
      expect(sauceGroup.name).toBe("Sauce");
      expect(sauceGroup.required).toBe(false);
      expect(sauceGroup.minSelect).toBe(0);
      expect(sauceGroup.maxSelect).toBe(3); // MULTIPLE → maxSelect = number of modifiers
      expect(sauceGroup.options).toHaveLength(3);
      expect(sauceGroup.options[0]).toMatchObject({
        name: "BBQ",
        price: 0,
        externalId: "mod-bbq",
      });
      expect(sauceGroup.options[1]).toMatchObject({
        name: "Buffalo",
        price: 0,
        externalId: "mod-buffalo",
      });
      expect(sauceGroup.options[2]).toMatchObject({
        name: "Truffle Aioli",
        price: 1.5,
        externalId: "mod-truffle",
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
      expect(result.taxes[0]).toMatchObject({
        externalId: "tax-sales",
        name: "Sales Tax",
        percentage: 8.875,
      });
    });
  });

  describe("item with no variations", () => {
    it("should gracefully handle with price 0 and no modifiers", () => {
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
        itemOptions: [],
        measurementUnits: [],
        images: [],
      };

      const result = service.mapToMenuModels(catalog);

      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item.externalId).toBe("item-special");
      expect(item.name).toBe("Chef's Special");
      expect(item.price).toBe(0);
      expect(item.modifiers).toBeNull();
      expect(item.variationMappings).toEqual([]);
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
        itemOptions: [],
        measurementUnits: [],
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

  // ============================================================
  // New coverage: Square Menu compatibility extensions (#89)
  // ============================================================

  const emptyCatalog = (): SquareCatalogResult => ({
    categories: [],
    items: [],
    modifierLists: [],
    taxes: [],
    itemOptions: [],
    measurementUnits: [],
    images: [],
  });

  describe("pricing type", () => {
    it("marks item as VARIABLE when all variations are VARIABLE_PRICING", () => {
      const catalog = emptyCatalog();
      catalog.items = [
        {
          type: "ITEM",
          id: "item-custom",
          itemData: {
            name: "Custom Drink",
            variations: [
              {
                id: "var-1",
                type: "ITEM_VARIATION",
                itemVariationData: {
                  name: "Any",
                  pricingType: "VARIABLE_PRICING",
                },
              },
            ],
          },
        },
      ];
      const result = service.mapToMenuModels(catalog);
      expect(result.items[0].pricingType).toBe("VARIABLE");
      expect(result.items[0].price).toBe(0);
    });

    it("marks item as FIXED when any variation is FIXED_PRICING", () => {
      const catalog = emptyCatalog();
      catalog.items = [
        {
          type: "ITEM",
          id: "item-mixed",
          itemData: {
            name: "Mixed",
            variations: [
              {
                id: "var-1",
                type: "ITEM_VARIATION",
                itemVariationData: {
                  name: "Default",
                  pricingType: "FIXED_PRICING",
                  priceMoney: { amount: BigInt(500), currency: "USD" },
                },
              },
            ],
          },
        },
      ];
      const result = service.mapToMenuModels(catalog);
      expect(result.items[0].pricingType).toBe("FIXED");
      expect(result.items[0].price).toBe(5);
    });
  });

  describe("multi-category items", () => {
    it("reads from itemData.categories[] when present", () => {
      const catalog = emptyCatalog();
      catalog.items = [
        {
          type: "ITEM",
          id: "item-multi",
          itemData: {
            name: "Multi",
            categoryId: "fallback-cat",
            categories: [{ id: "cat-a" }, { id: "cat-b" }],
            variations: [
              {
                id: "v1",
                type: "ITEM_VARIATION",
                itemVariationData: {
                  name: "D",
                  priceMoney: { amount: BigInt(100), currency: "USD" },
                },
              },
            ],
          },
        },
      ];
      const result = service.mapToMenuModels(catalog);
      expect(result.items[0].categoryExternalIds).toEqual(["cat-a", "cat-b"]);
    });

    it("falls back to itemData.categoryId when categories[] is empty", () => {
      const catalog = emptyCatalog();
      catalog.items = [
        {
          type: "ITEM",
          id: "item-legacy",
          itemData: {
            name: "Legacy",
            categoryId: "legacy-cat",
            variations: [
              {
                id: "v1",
                type: "ITEM_VARIATION",
                itemVariationData: {
                  name: "D",
                  priceMoney: { amount: BigInt(100), currency: "USD" },
                },
              },
            ],
          },
        },
      ];
      const result = service.mapToMenuModels(catalog);
      expect(result.items[0].categoryExternalIds).toEqual(["legacy-cat"]);
    });
  });

  describe("tax inclusion and phase", () => {
    it("maps inclusionType, calculationPhase, and appliesToCustomAmounts", () => {
      const catalog = emptyCatalog();
      catalog.taxes = [
        {
          type: "TAX",
          id: "tax-inclusive",
          taxData: {
            name: "VAT",
            percentage: "10.0",
            enabled: true,
            inclusionType: "INCLUSIVE",
            calculationPhase: "TAX_TOTAL_PHASE",
            appliesToCustomAmounts: true,
          },
        },
      ];
      const result = service.mapToMenuModels(catalog);
      expect(result.taxes).toHaveLength(1);
      expect(result.taxes[0]).toMatchObject({
        externalId: "tax-inclusive",
        name: "VAT",
        percentage: 10,
        inclusionType: "INCLUSIVE",
        calculationPhase: "TOTAL",
        appliesToCustomAmounts: true,
      });
    });

    it("defaults to ADDITIVE and SUBTOTAL when fields missing", () => {
      const catalog = emptyCatalog();
      catalog.taxes = [
        {
          type: "TAX",
          id: "tax-default",
          taxData: { name: "Sales", percentage: "7.0", enabled: true },
        },
      ];
      const result = service.mapToMenuModels(catalog);
      expect(result.taxes[0].inclusionType).toBe("ADDITIVE");
      expect(result.taxes[0].calculationPhase).toBe("SUBTOTAL");
      expect(result.taxes[0].appliesToCustomAmounts).toBe(false);
    });
  });

  describe("modifier list: min/max selected override", () => {
    it("uses list-level minSelected/maxSelected over deprecated selectionType", () => {
      const catalog = emptyCatalog();
      catalog.modifierLists = [
        {
          type: "MODIFIER_LIST",
          id: "ml-toppings",
          modifierListData: {
            name: "Toppings",
            selectionType: "SINGLE",
            minSelectedModifiers: BigInt(0),
            maxSelectedModifiers: BigInt(3),
            modifiers: [
              {
                id: "m1",
                type: "MODIFIER",
                modifierData: {
                  name: "Cheese",
                  priceMoney: { amount: BigInt(100), currency: "USD" },
                },
              },
              {
                id: "m2",
                type: "MODIFIER",
                modifierData: {
                  name: "Bacon",
                  priceMoney: { amount: BigInt(200), currency: "USD" },
                },
              },
            ],
          },
        },
      ];
      catalog.items = [
        {
          type: "ITEM",
          id: "item-burger",
          itemData: {
            name: "Burger",
            variations: [
              {
                id: "v1",
                type: "ITEM_VARIATION",
                itemVariationData: {
                  name: "R",
                  priceMoney: { amount: BigInt(1000), currency: "USD" },
                },
              },
            ],
            modifierListInfo: [{ modifierListId: "ml-toppings", enabled: true }],
          },
        },
      ];
      const result = service.mapToMenuModels(catalog);
      const group = result.items[0].modifiers!.groups[0];
      expect(group.minSelect).toBe(0);
      expect(group.maxSelect).toBe(3); // overrides selectionType=SINGLE
      expect(group.type).toBe("multiple");
    });

    it("item-level modifierListInfo overrides list-level limits", () => {
      const catalog = emptyCatalog();
      catalog.modifierLists = [
        {
          type: "MODIFIER_LIST",
          id: "ml-extras",
          modifierListData: {
            name: "Extras",
            minSelectedModifiers: BigInt(0),
            maxSelectedModifiers: BigInt(5),
            modifiers: [
              {
                id: "m1",
                type: "MODIFIER",
                modifierData: {
                  name: "A",
                  priceMoney: { amount: BigInt(0), currency: "USD" },
                },
              },
            ],
          },
        },
      ];
      catalog.items = [
        {
          type: "ITEM",
          id: "item-x",
          itemData: {
            name: "X",
            variations: [
              {
                id: "v1",
                type: "ITEM_VARIATION",
                itemVariationData: {
                  name: "R",
                  priceMoney: { amount: BigInt(500), currency: "USD" },
                },
              },
            ],
            modifierListInfo: [
              {
                modifierListId: "ml-extras",
                enabled: true,
                minSelectedModifiers: 1,
                maxSelectedModifiers: 2,
              },
            ],
          },
        },
      ];
      const result = service.mapToMenuModels(catalog);
      const group = result.items[0].modifiers!.groups[0];
      expect(group.minSelect).toBe(1);
      expect(group.maxSelect).toBe(2);
      expect(group.required).toBe(true);
    });
  });

  describe("modifier extended fields (onByDefault, ordinal, hiddenOnline)", () => {
    it("propagates modifier metadata and filters hiddenOnline", () => {
      const catalog = emptyCatalog();
      catalog.modifierLists = [
        {
          type: "MODIFIER_LIST",
          id: "ml-sauces",
          modifierListData: {
            name: "Sauces",
            selectionType: "MULTIPLE",
            modifiers: [
              {
                id: "m-visible",
                type: "MODIFIER",
                modifierData: {
                  name: "Ketchup",
                  onByDefault: true,
                  ordinal: 1,
                  kitchenName: "KCH",
                  priceMoney: { amount: BigInt(0), currency: "USD" },
                },
              },
              {
                id: "m-hidden",
                type: "MODIFIER",
                modifierData: {
                  name: "Secret",
                  ordinal: 2,
                  hiddenOnline: true,
                  priceMoney: { amount: BigInt(0), currency: "USD" },
                },
              },
            ],
          },
        },
      ];
      catalog.items = [
        {
          type: "ITEM",
          id: "item-fries",
          itemData: {
            name: "Fries",
            variations: [
              {
                id: "v1",
                type: "ITEM_VARIATION",
                itemVariationData: {
                  name: "R",
                  priceMoney: { amount: BigInt(300), currency: "USD" },
                },
              },
            ],
            modifierListInfo: [{ modifierListId: "ml-sauces", enabled: true }],
          },
        },
      ];
      const result = service.mapToMenuModels(catalog);
      const group = result.items[0].modifiers!.groups[0];
      expect(group.options).toHaveLength(1);
      const opt = group.options[0];
      expect(opt.name).toBe("Ketchup");
      expect(opt.isDefault).toBe(true);
      expect(opt.ordinal).toBe(1);
      expect(opt.kitchenName).toBe("KCH");
      expect(opt.hiddenOnline).toBe(false);
    });
  });

  describe("TEXT-type modifier list", () => {
    it("maps to an empty-options group with type='text'", () => {
      const catalog = emptyCatalog();
      catalog.modifierLists = [
        {
          type: "MODIFIER_LIST",
          id: "ml-note",
          modifierListData: {
            name: "Special Request",
            modifierType: "TEXT",
            textRequired: true,
            maxLength: 100,
          },
        },
      ];
      catalog.items = [
        {
          type: "ITEM",
          id: "item-note",
          itemData: {
            name: "Custom Cake",
            variations: [
              {
                id: "v1",
                type: "ITEM_VARIATION",
                itemVariationData: {
                  name: "R",
                  priceMoney: { amount: BigInt(2000), currency: "USD" },
                },
              },
            ],
            modifierListInfo: [{ modifierListId: "ml-note", enabled: true }],
          },
        },
      ];
      const result = service.mapToMenuModels(catalog);
      const group = result.items[0].modifiers!.groups[0];
      expect(group.type).toBe("text");
      expect(group.options).toEqual([]);
      expect(group.required).toBe(true);
    });
  });

  describe("sellable=false variations are filtered", () => {
    it("drops unsellable variations before price/group computation", () => {
      const catalog = emptyCatalog();
      catalog.items = [
        {
          type: "ITEM",
          id: "item-mixed",
          itemData: {
            name: "Item",
            variations: [
              {
                id: "v-sold",
                type: "ITEM_VARIATION",
                itemVariationData: {
                  name: "Sold Only",
                  sellable: true,
                  priceMoney: { amount: BigInt(1000), currency: "USD" },
                },
              },
              {
                id: "v-component",
                type: "ITEM_VARIATION",
                itemVariationData: {
                  name: "Component",
                  sellable: false,
                  priceMoney: { amount: BigInt(500), currency: "USD" },
                },
              },
            ],
          },
        },
      ];
      const result = service.mapToMenuModels(catalog);
      expect(result.items[0].variationMappings).toHaveLength(1);
      expect(result.items[0].variationMappings[0].externalId).toBe("v-sold");
      expect(result.items[0].modifiers).toBeNull(); // only 1 sellable → no Size group
    });
  });

  describe("source metadata", () => {
    it("captures un-first-classed fields into sourceMetadata", () => {
      const catalog = emptyCatalog();
      catalog.items = [
        {
          type: "ITEM",
          id: "item-rich",
          itemData: {
            name: "Rich",
            abbreviation: "RCH",
            labelColor: "#ff0000",
            buyerFacingName: "Rich (Display)",
            sortName: "Zrich",
            descriptionHtml: "<p>Rich</p>",
            skipModifierScreen: true,
            isTaxable: false,
            isArchived: false,
            isAlcoholic: true,
            productType: "FOOD_AND_BEV",
            variations: [
              {
                id: "v1",
                type: "ITEM_VARIATION",
                itemVariationData: {
                  name: "R",
                  sku: "SKU-1",
                  upc: "UPC-1",
                  priceMoney: { amount: BigInt(100), currency: "USD" },
                },
              },
            ],
          },
        },
      ];
      const result = service.mapToMenuModels(catalog);
      const item = result.items[0];
      expect(item.sourceMetadata.abbreviation).toBe("RCH");
      expect(item.sourceMetadata.labelColor).toBe("#ff0000");
      expect(item.sourceMetadata.buyerFacingName).toBe("Rich (Display)");
      expect(item.sourceMetadata.sortName).toBe("Zrich");
      expect(item.sourceMetadata.descriptionHtml).toBe("<p>Rich</p>");
      expect(item.sourceMetadata.skipModifierScreen).toBe(true);
      expect(item.sourceMetadata.isTaxable).toBe(false);
      expect(item.sourceMetadata.isAlcoholic).toBe(true);
      expect(item.sourceMetadata.productType).toBe("FOOD_AND_BEV");
      expect(item.tags).toContain("alcoholic");
      expect(item.variationMappings[0].sku).toBe("SKU-1");
      expect(item.variationMappings[0].upc).toBe("UPC-1");
    });
  });

  describe("non-food product types are skipped", () => {
    it("ignores APPOINTMENTS_SERVICE items", () => {
      const catalog = emptyCatalog();
      catalog.items = [
        {
          type: "ITEM",
          id: "item-appt",
          itemData: {
            name: "Haircut",
            productType: "APPOINTMENTS_SERVICE",
            variations: [
              {
                id: "v1",
                type: "ITEM_VARIATION",
                itemVariationData: {
                  name: "30min",
                  priceMoney: { amount: BigInt(5000), currency: "USD" },
                },
              },
            ],
          },
        },
      ];
      const result = service.mapToMenuModels(catalog);
      expect(result.items).toHaveLength(0);
    });
  });

  describe("image resolution via imageMap", () => {
    it("resolves imageIds against IMAGE objects", () => {
      const catalog = emptyCatalog();
      catalog.images = [
        {
          type: "IMAGE",
          id: "img-1",
          imageData: { url: "https://cdn/img1.jpg" },
        },
        {
          type: "IMAGE",
          id: "img-2",
          imageData: { url: "https://cdn/img2.jpg" },
        },
      ];
      catalog.items = [
        {
          type: "ITEM",
          id: "item-pic",
          itemData: {
            name: "Pic",
            imageIds: ["img-1", "img-2"],
            variations: [
              {
                id: "v1",
                type: "ITEM_VARIATION",
                itemVariationData: {
                  name: "R",
                  priceMoney: { amount: BigInt(100), currency: "USD" },
                },
              },
            ],
          },
        },
      ];
      const result = service.mapToMenuModels(catalog);
      expect(result.items[0].imageUrl).toBe("https://cdn/img1.jpg");
      expect(result.items[0].sourceMetadata.imageUrls).toEqual([
        "https://cdn/img1.jpg",
        "https://cdn/img2.jpg",
      ]);
    });
  });

  describe("item options flatten to synthetic groups", () => {
    it("generates one group per ITEM_OPTION with its values as options", () => {
      const catalog = emptyCatalog();
      catalog.itemOptions = [
        {
          type: "ITEM_OPTION",
          id: "opt-size",
          itemOptionData: {
            name: "size",
            displayName: "Size",
            values: [
              {
                type: "ITEM_OPTION_VAL",
                id: "val-s",
                itemOptionValueData: { name: "Small", ordinal: 1 },
              },
              {
                type: "ITEM_OPTION_VAL",
                id: "val-l",
                itemOptionValueData: { name: "Large", ordinal: 2 },
              },
            ],
          },
        },
      ];
      catalog.items = [
        {
          type: "ITEM",
          id: "item-shirt",
          itemData: {
            name: "Shirt",
            itemOptions: [{ itemOptionId: "opt-size" }],
            variations: [
              {
                id: "v1",
                type: "ITEM_VARIATION",
                itemVariationData: {
                  name: "Small",
                  priceMoney: { amount: BigInt(2000), currency: "USD" },
                },
              },
            ],
          },
        },
      ];
      const result = service.mapToMenuModels(catalog);
      const group = result.items[0].modifiers!.groups[0];
      expect(group.name).toBe("Size");
      expect(group.sourceKind).toBe("ITEM_OPTION");
      expect(group.options.map((o) => o.name)).toEqual(["Small", "Large"]);
    });
  });
});
