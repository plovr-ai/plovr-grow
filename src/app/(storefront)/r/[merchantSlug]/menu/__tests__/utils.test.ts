import { describe, it, expect } from "vitest";
import { parseModifierGroups, convertToMenuDisplayData } from "../utils";
import type { GetMenuResponseWithItemCount } from "../utils";

describe("parseModifierGroups", () => {
  it("should return empty array for undefined input", () => {
    expect(parseModifierGroups(undefined)).toEqual([]);
  });

  it("should return empty array for empty array", () => {
    expect(parseModifierGroups([])).toEqual([]);
  });

  describe("relational modifier groups", () => {
    it("should parse relational modifier groups when provided", () => {
      const relationalGroups = [
        {
          sortOrder: 0,
          modifierGroup: {
            id: "mg-1",
            name: "Size",
            required: true,
            minSelect: 1,
            maxSelect: 1,
            allowQuantity: false,
            maxQuantityPerModifier: 1,
            options: [
              {
                id: "opt-1",
                name: "Small",
                price: 0,
                isDefault: true,
                isAvailable: true,
                sortOrder: 0,
              },
              {
                id: "opt-2",
                name: "Large",
                price: 2.5,
                isDefault: false,
                isAvailable: true,
                sortOrder: 1,
              },
            ],
          },
        },
      ];

      const result = parseModifierGroups(relationalGroups);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("mg-1");
      expect(result[0].name).toBe("Size");
      expect(result[0].required).toBe(true);
      expect(result[0].minSelections).toBe(1);
      expect(result[0].maxSelections).toBe(1);
      expect(result[0].modifiers).toHaveLength(2);
      expect(result[0].modifiers[0].id).toBe("opt-1");
      expect(result[0].modifiers[0].price).toBe(0);
      expect(result[0].modifiers[1].price).toBe(2.5);
    });

    it("should handle Decimal price objects with toNumber()", () => {
      const relationalGroups = [
        {
          sortOrder: 0,
          modifierGroup: {
            id: "mg-1",
            name: "Size",
            required: false,
            minSelect: 0,
            maxSelect: 3,
            allowQuantity: true,
            maxQuantityPerModifier: 5,
            options: [
              {
                id: "opt-1",
                name: "Cheese",
                price: { toNumber: () => 1.5 },
                isDefault: false,
                isAvailable: true,
                sortOrder: 0,
              },
            ],
          },
        },
      ];

      const result = parseModifierGroups(relationalGroups);

      expect(result[0].modifiers[0].price).toBe(1.5);
      expect(result[0].allowQuantity).toBe(true);
      expect(result[0].maxQuantityPerModifier).toBe(5);
    });

    it("should handle string price values via Number() fallback", () => {
      const relationalGroups = [
        {
          sortOrder: 0,
          modifierGroup: {
            id: "mg-1",
            name: "Test",
            required: false,
            minSelect: 0,
            maxSelect: 1,
            allowQuantity: false,
            maxQuantityPerModifier: 1,
            options: [
              {
                id: "opt-1",
                name: "Option",
                price: "2.50", // string, no toNumber method
                isDefault: false,
                isAvailable: true,
                sortOrder: 0,
              },
            ],
          },
        },
      ];

      const result = parseModifierGroups(relationalGroups as never);

      expect(result[0].modifiers[0].price).toBe(2.5);
    });
  });
});

describe("convertToMenuDisplayData", () => {
  const baseResponse = {
    currentMenuId: "menu-1",
    menus: [
      { id: "menu-1", name: "Lunch", itemCount: 2 },
      { id: "menu-2", name: "Empty Menu", itemCount: 0 },
    ],
    categories: [
      {
        id: "cat-1",
        name: "Appetizers",
        description: "Starters",
        sortOrder: 0,
        menuItems: [
          {
            id: "item-1",
            name: "Spring Rolls",
            description: "Crispy",
            price: 8.99,
            imageUrl: null,
            modifiers: null,
            tags: null,
            status: "active",
            taxes: [],
          },
        ],
      },
      {
        id: "cat-2",
        name: "Empty Category",
        description: null,
        sortOrder: 1,
        menuItems: [],
      },
    ],
  } as unknown as GetMenuResponseWithItemCount;

  it("should filter out empty categories", () => {
    const result = convertToMenuDisplayData(baseResponse, "test-co");
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].category.name).toBe("Appetizers");
  });

  it("should filter out empty menus (itemCount=0)", () => {
    const result = convertToMenuDisplayData(baseResponse, "test-co");
    expect(result.menus).toHaveLength(1);
    expect(result.menus[0].name).toBe("Lunch");
  });

  it("should convert items correctly", () => {
    const result = convertToMenuDisplayData(baseResponse, "test-co");
    const item = result.categories[0].items[0];
    expect(item.id).toBe("item-1");
    expect(item.name).toBe("Spring Rolls");
    expect(item.price).toBe(8.99);
    expect(item.hasModifiers).toBe(false);
    expect(item.isAvailable).toBe(true);
    expect(item.tags).toEqual([]);
  });

  it("should set companySlug and currentMenuId", () => {
    const result = convertToMenuDisplayData(baseResponse, "test-co");
    expect(result.companySlug).toBe("test-co");
    expect(result.currentMenuId).toBe("menu-1");
  });

  it("should handle items with modifiers", () => {
    const withModifiers = {
      ...baseResponse,
      categories: [
        {
          id: "cat-1",
          name: "Mains",
          description: null,
          sortOrder: 0,
          menuItems: [
            {
              id: "item-2",
              name: "Pad Thai",
              description: null,
              price: 14.99,
              imageUrl: "https://example.com/padthai.jpg",
              modifierGroups: [
                {
                  sortOrder: 0,
                  modifierGroup: {
                    id: "spice",
                    name: "Spice Level",
                    required: true,
                    minSelect: 1,
                    maxSelect: 1,
                    allowQuantity: false,
                    maxQuantityPerModifier: 1,
                    options: [
                      {
                        id: "s1",
                        name: "Mild",
                        price: 0,
                        isDefault: true,
                        isAvailable: true,
                        sortOrder: 0,
                      },
                    ],
                  },
                },
              ],
              tags: [{ label: "Spicy", color: "red" }],
              status: "active",
              taxes: [
                {
                  taxConfigId: "t1",
                  name: "Tax",
                  rate: 0.08,
                  roundingMethod: "half_up",
                  inclusionType: "additive" as const,
                },
              ],
            },
          ],
        },
      ],
    };

    const result = convertToMenuDisplayData(
      withModifiers as unknown as GetMenuResponseWithItemCount,
      "test-co"
    );
    const item = result.categories[0].items[0];
    expect(item.hasModifiers).toBe(true);
    expect(item.modifierGroups).toHaveLength(1);
  });

  it("should mark inactive items as unavailable", () => {
    const withInactive = {
      ...baseResponse,
      categories: [
        {
          id: "cat-1",
          name: "Items",
          description: null,
          sortOrder: 0,
          menuItems: [
            {
              id: "item-inactive",
              name: "Unavailable Item",
              description: null,
              price: 5,
              imageUrl: null,
              modifiers: null,
              tags: null,
              status: "inactive",
              taxes: [],
            },
          ],
        },
      ],
    };

    const result = convertToMenuDisplayData(
      withInactive as unknown as GetMenuResponseWithItemCount,
      "test-co"
    );
    expect(result.categories[0].items[0].isAvailable).toBe(false);
  });

  it("should handle item with undefined taxes", () => {
    const withNoTaxes = {
      menus: [{ id: "m1", name: "Menu", itemCount: 1 }],
      categories: [
        {
          id: "cat-1",
          name: "Test",
          description: null,
          sortOrder: 0,
          menuItems: [
            {
              id: "item-no-tax",
              name: "No Tax Item",
              description: null,
              price: 10,
              imageUrl: null,
              modifiers: null,
              tags: null,
              status: "active",
              taxes: undefined as unknown as never[],
            },
          ],
        },
      ],
    };

    const result = convertToMenuDisplayData(
      withNoTaxes as unknown as GetMenuResponseWithItemCount,
      "co"
    );
    expect(result.categories[0].items[0].taxes).toEqual([]);
  });
});
