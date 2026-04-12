import { describe, it, expect } from "vitest";
import { mapOrderItemToData } from "../order.service";
import type { OrderItemWithModifiers } from "@/repositories/order.repository";
import type { Prisma } from "@prisma/client";

/** Helper to create a Prisma Decimal-like value that Number() can convert */
function decimal(value: number): Prisma.Decimal {
  return value as unknown as Prisma.Decimal;
}

function makeOrderItem(
  overrides: Partial<OrderItemWithModifiers> = {}
): OrderItemWithModifiers {
  return {
    id: "oi-1",
    orderId: "order-1",
    menuItemId: "item-1",
    name: "Margherita Pizza",
    unitPrice: decimal(18.99),
    quantity: 2,
    totalPrice: decimal(37.98),
    notes: null,
    imageUrl: null,
    taxes: null,
    sortOrder: 0,
    deleted: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    modifiers: [],
    ...overrides,
  };
}

describe("mapOrderItemToData()", () => {
  it("maps basic fields correctly", () => {
    const result = mapOrderItemToData(makeOrderItem());

    expect(result.menuItemId).toBe("item-1");
    expect(result.name).toBe("Margherita Pizza");
    expect(result.price).toBe(18.99);
    expect(result.quantity).toBe(2);
    expect(result.totalPrice).toBe(37.98);
    expect(result.selectedModifiers).toEqual([]);
    expect(result.specialInstructions).toBeUndefined();
    expect(result.imageUrl).toBeNull();
    expect(result.taxes).toBeUndefined();
  });

  it("maps notes to specialInstructions", () => {
    const result = mapOrderItemToData(
      makeOrderItem({ notes: "No onions please" })
    );

    expect(result.specialInstructions).toBe("No onions please");
  });

  it("maps null notes to undefined specialInstructions", () => {
    const result = mapOrderItemToData(makeOrderItem({ notes: null }));

    expect(result.specialInstructions).toBeUndefined();
  });

  it("maps imageUrl from OrderItem", () => {
    const result = mapOrderItemToData(
      makeOrderItem({ imageUrl: "https://cdn.example.com/pizza.jpg" })
    );

    expect(result.imageUrl).toBe("https://cdn.example.com/pizza.jpg");
  });

  it("maps taxes JSON to ItemTaxInfo array", () => {
    const taxes = [
      {
        taxConfigId: "tax-1",
        name: "Sales Tax",
        rate: 0.08875,
        roundingMethod: "half_up" as const,
        inclusionType: "additive" as const,
      },
    ];
    const result = mapOrderItemToData(makeOrderItem({ taxes }));

    expect(result.taxes).toEqual(taxes);
  });

  it("maps null taxes to undefined", () => {
    const result = mapOrderItemToData(makeOrderItem({ taxes: null }));

    expect(result.taxes).toBeUndefined();
  });

  it("maps modifiers to selectedModifiers with correct field names", () => {
    const result = mapOrderItemToData(
      makeOrderItem({
        modifiers: [
          {
            id: "om-1",
            orderItemId: "oi-1",
            modifierGroupId: "grp-size",
            modifierOptionId: "opt-large",
            groupName: "Size",
            name: "Large",
            price: decimal(2.5),
            quantity: 1,
            deleted: false,
            createdAt: new Date("2026-01-01"),
            updatedAt: new Date("2026-01-01"),
          },
        ],
      })
    );

    expect(result.selectedModifiers).toHaveLength(1);
    expect(result.selectedModifiers[0]).toEqual({
      groupId: "grp-size",
      groupName: "Size",
      modifierId: "opt-large",
      modifierName: "Large",
      price: 2.5,
      quantity: 1,
    });
  });

  it("maps multiple modifiers from different groups", () => {
    const result = mapOrderItemToData(
      makeOrderItem({
        modifiers: [
          {
            id: "om-1",
            orderItemId: "oi-1",
            modifierGroupId: "grp-size",
            modifierOptionId: "opt-large",
            groupName: "Size",
            name: "Large",
            price: decimal(2.5),
            quantity: 1,
            deleted: false,
            createdAt: new Date("2026-01-01"),
            updatedAt: new Date("2026-01-01"),
          },
          {
            id: "om-2",
            orderItemId: "oi-1",
            modifierGroupId: "grp-extras",
            modifierOptionId: "opt-cheese",
            groupName: "Extras",
            name: "Extra Cheese",
            price: decimal(1.5),
            quantity: 2,
            deleted: false,
            createdAt: new Date("2026-01-01"),
            updatedAt: new Date("2026-01-01"),
          },
        ],
      })
    );

    expect(result.selectedModifiers).toHaveLength(2);
    expect(result.selectedModifiers[0].groupId).toBe("grp-size");
    expect(result.selectedModifiers[0].modifierName).toBe("Large");
    expect(result.selectedModifiers[1].groupId).toBe("grp-extras");
    expect(result.selectedModifiers[1].modifierName).toBe("Extra Cheese");
    expect(result.selectedModifiers[1].price).toBe(1.5);
    expect(result.selectedModifiers[1].quantity).toBe(2);
  });

  it("converts Decimal fields to numbers", () => {
    // Verify the Number() conversion works with Prisma Decimal-like values
    const result = mapOrderItemToData(
      makeOrderItem({
        unitPrice: decimal(9.99),
        totalPrice: decimal(19.98),
        modifiers: [
          {
            id: "om-1",
            orderItemId: "oi-1",
            modifierGroupId: "g1",
            modifierOptionId: "o1",
            groupName: "G",
            name: "M",
            price: decimal(0.75),
            quantity: 1,
            deleted: false,
            createdAt: new Date("2026-01-01"),
            updatedAt: new Date("2026-01-01"),
          },
        ],
      })
    );

    expect(typeof result.price).toBe("number");
    expect(result.price).toBe(9.99);
    expect(typeof result.totalPrice).toBe("number");
    expect(result.totalPrice).toBe(19.98);
    expect(typeof result.selectedModifiers[0].price).toBe("number");
    expect(result.selectedModifiers[0].price).toBe(0.75);
  });
});
