import { describe, it, expect } from "vitest";
import { parseModifierGroups } from "../utils";

describe("parseModifierGroups", () => {
  describe("basic parsing", () => {
    it("should return empty array for null options", () => {
      expect(parseModifierGroups(null)).toEqual([]);
    });

    it("should return empty array for non-array options", () => {
      expect(parseModifierGroups("invalid")).toEqual([]);
      expect(parseModifierGroups({})).toEqual([]);
      expect(parseModifierGroups(123)).toEqual([]);
    });

    it("should parse basic modifier group", () => {
      const options = [
        {
          id: "size",
          name: "Size",
          type: "single",
          required: true,
          modifiers: [
            { id: "size-s", name: "Small", price: 0 },
            { id: "size-m", name: "Medium", price: 4 },
          ],
        },
      ];

      const result = parseModifierGroups(options);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("size");
      expect(result[0].name).toBe("Size");
      expect(result[0].required).toBe(true);
      expect(result[0].minSelections).toBe(1);
      expect(result[0].maxSelections).toBe(1); // single type
      expect(result[0].modifiers).toHaveLength(2);
    });

    it("should set maxSelections to modifier count for multiple type", () => {
      const options = [
        {
          id: "toppings",
          name: "Toppings",
          type: "multiple",
          required: false,
          modifiers: [
            { id: "t1", name: "Cheese", price: 1 },
            { id: "t2", name: "Pepperoni", price: 2 },
            { id: "t3", name: "Mushrooms", price: 1.5 },
          ],
        },
      ];

      const result = parseModifierGroups(options);

      expect(result[0].minSelections).toBe(0);
      expect(result[0].maxSelections).toBe(3);
    });
  });

  describe("allowQuantity and maxQuantityPerModifier", () => {
    it("should default allowQuantity to false", () => {
      const options = [
        {
          id: "toppings",
          name: "Toppings",
          type: "multiple",
          required: false,
          modifiers: [{ id: "t1", name: "Cheese", price: 1 }],
        },
      ];

      const result = parseModifierGroups(options);
      expect(result[0].allowQuantity).toBe(false);
    });

    it("should default maxQuantityPerModifier to 1", () => {
      const options = [
        {
          id: "toppings",
          name: "Toppings",
          type: "multiple",
          required: false,
          modifiers: [{ id: "t1", name: "Cheese", price: 1 }],
        },
      ];

      const result = parseModifierGroups(options);
      expect(result[0].maxQuantityPerModifier).toBe(1);
    });

    it("should parse allowQuantity when provided", () => {
      const options = [
        {
          id: "toppings",
          name: "Extra Toppings",
          type: "multiple",
          required: false,
          allowQuantity: true,
          maxQuantityPerModifier: 3,
          modifiers: [{ id: "t1", name: "Cheese", price: 1.5 }],
        },
      ];

      const result = parseModifierGroups(options);
      expect(result[0].allowQuantity).toBe(true);
      expect(result[0].maxQuantityPerModifier).toBe(3);
    });
  });

  describe("isDefault", () => {
    it("should use isDefault from data when provided", () => {
      const options = [
        {
          id: "size",
          name: "Size",
          type: "single",
          required: true,
          modifiers: [
            { id: "size-s", name: "Small", price: 0, isDefault: false },
            { id: "size-m", name: "Medium", price: 4, isDefault: true },
            { id: "size-l", name: "Large", price: 8, isDefault: false },
          ],
        },
      ];

      const result = parseModifierGroups(options);
      expect(result[0].modifiers[0].isDefault).toBe(false);
      expect(result[0].modifiers[1].isDefault).toBe(true);
      expect(result[0].modifiers[2].isDefault).toBe(false);
    });

    it("should default first modifier to isDefault=true for required groups", () => {
      const options = [
        {
          id: "size",
          name: "Size",
          type: "single",
          required: true,
          modifiers: [
            { id: "size-s", name: "Small", price: 0 },
            { id: "size-m", name: "Medium", price: 4 },
          ],
        },
      ];

      const result = parseModifierGroups(options);
      expect(result[0].modifiers[0].isDefault).toBe(true);
      expect(result[0].modifiers[1].isDefault).toBe(false);
    });

    it("should not set isDefault for optional groups without explicit isDefault", () => {
      const options = [
        {
          id: "extras",
          name: "Extras",
          type: "multiple",
          required: false,
          modifiers: [
            { id: "e1", name: "Bacon", price: 2 },
            { id: "e2", name: "Egg", price: 1.5 },
          ],
        },
      ];

      const result = parseModifierGroups(options);
      expect(result[0].modifiers[0].isDefault).toBe(false);
      expect(result[0].modifiers[1].isDefault).toBe(false);
    });
  });

  describe("isAvailable and availabilityNote", () => {
    it("should default isAvailable to true", () => {
      const options = [
        {
          id: "toppings",
          name: "Toppings",
          type: "multiple",
          required: false,
          modifiers: [{ id: "t1", name: "Cheese", price: 1 }],
        },
      ];

      const result = parseModifierGroups(options);
      expect(result[0].modifiers[0].isAvailable).toBe(true);
    });

    it("should parse isAvailable when set to false", () => {
      const options = [
        {
          id: "toppings",
          name: "Toppings",
          type: "multiple",
          required: false,
          modifiers: [
            { id: "t1", name: "Cheese", price: 1, isAvailable: true },
            { id: "t2", name: "Avocado", price: 2.5, isAvailable: false },
          ],
        },
      ];

      const result = parseModifierGroups(options);
      expect(result[0].modifiers[0].isAvailable).toBe(true);
      expect(result[0].modifiers[1].isAvailable).toBe(false);
    });

    it("should parse availabilityNote", () => {
      const options = [
        {
          id: "toppings",
          name: "Toppings",
          type: "multiple",
          required: false,
          modifiers: [
            {
              id: "t1",
              name: "Avocado",
              price: 2.5,
              isAvailable: false,
              availabilityNote: "Sold out",
            },
          ],
        },
      ];

      const result = parseModifierGroups(options);
      expect(result[0].modifiers[0].availabilityNote).toBe("Sold out");
    });
  });

  describe("backward compatibility (choices field)", () => {
    it("should support legacy choices field", () => {
      const options = [
        {
          id: "size",
          name: "Size",
          type: "single",
          required: true,
          choices: [
            { id: "size-s", name: "Small", price: 0 },
            { id: "size-m", name: "Medium", price: 4 },
          ],
        },
      ];

      const result = parseModifierGroups(options);

      expect(result).toHaveLength(1);
      expect(result[0].modifiers).toHaveLength(2);
      expect(result[0].modifiers[0].name).toBe("Small");
      expect(result[0].modifiers[1].name).toBe("Medium");
    });

    it("should prefer modifiers over choices when both present", () => {
      const options = [
        {
          id: "size",
          name: "Size",
          type: "single",
          required: true,
          modifiers: [{ id: "m1", name: "From Modifiers", price: 0 }],
          choices: [{ id: "c1", name: "From Choices", price: 0 }],
        },
      ];

      const result = parseModifierGroups(options);
      expect(result[0].modifiers[0].name).toBe("From Modifiers");
    });
  });

  describe("complete modifier group parsing", () => {
    it("should parse a complete modifier group with all new fields", () => {
      const options = [
        {
          id: "toppings",
          name: "Extra Toppings",
          type: "multiple",
          required: false,
          allowQuantity: true,
          maxQuantityPerModifier: 3,
          modifiers: [
            { id: "t1", name: "Extra Cheese", price: 1.5, isDefault: false, isAvailable: true },
            { id: "t2", name: "Pepperoni", price: 2.0, isDefault: false, isAvailable: true },
            {
              id: "t3",
              name: "Jalapenos",
              price: 1.5,
              isDefault: false,
              isAvailable: false,
              availabilityNote: "Sold out",
            },
          ],
        },
      ];

      const result = parseModifierGroups(options);

      expect(result[0]).toEqual({
        id: "toppings",
        name: "Extra Toppings",
        required: false,
        minSelections: 0,
        maxSelections: 3,
        allowQuantity: true,
        maxQuantityPerModifier: 3,
        modifiers: [
          { id: "t1", name: "Extra Cheese", price: 1.5, isDefault: false, isAvailable: true, availabilityNote: undefined },
          { id: "t2", name: "Pepperoni", price: 2.0, isDefault: false, isAvailable: true, availabilityNote: undefined },
          { id: "t3", name: "Jalapenos", price: 1.5, isDefault: false, isAvailable: false, availabilityNote: "Sold out" },
        ],
      });
    });
  });
});
