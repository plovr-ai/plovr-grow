import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePricing } from "../usePricing";
import type { CartItem, ItemTaxInfo } from "@/types";

// Helper to create a cart item
function createCartItem(
  overrides: Partial<CartItem> = {}
): CartItem {
  return {
    id: "cart-1",
    menuItemId: "item-1",
    name: "Test Item",
    price: 10.0,
    quantity: 1,
    selectedModifiers: [],
    totalPrice: 10.0,
    ...overrides,
  };
}

// Helper to create tax info
function createTaxInfo(
  overrides: Partial<ItemTaxInfo> = {}
): ItemTaxInfo {
  return {
    taxConfigId: "tax-standard",
    name: "Standard Tax",
    rate: 0.0825,
    roundingMethod: "half_up",
    inclusionType: "additive",
    ...overrides,
  };
}

describe("usePricing", () => {
  describe("basic pricing calculation", () => {
    it("should calculate subtotal for single item", () => {
      const items: CartItem[] = [
        createCartItem({ totalPrice: 18.99, quantity: 1 }),
      ];

      const { result } = renderHook(() => usePricing(items));

      expect(result.current.subtotal).toBe(18.99);
    });

    it("should calculate subtotal for multiple items", () => {
      const items: CartItem[] = [
        createCartItem({ id: "cart-1", totalPrice: 18.99, quantity: 1 }),
        createCartItem({ id: "cart-2", totalPrice: 37.98, quantity: 2 }),
      ];

      const { result } = renderHook(() => usePricing(items));

      // 18.99 + 37.98 = 56.97
      expect(result.current.subtotal).toBe(56.97);
    });

    it("should return zero for empty cart", () => {
      const { result } = renderHook(() => usePricing([]));

      expect(result.current.subtotal).toBe(0);
      expect(result.current.taxAmount).toBe(0);
      expect(result.current.totalAmount).toBe(0);
    });
  });

  describe("tax calculation with taxes array", () => {
    it("should calculate tax using item taxes array", () => {
      const items: CartItem[] = [
        createCartItem({
          totalPrice: 18.99,
          quantity: 1,
          taxes: [createTaxInfo({ rate: 0.0825 })],
        }),
      ];

      const { result } = renderHook(() => usePricing(items));

      // 18.99 * 0.0825 = 1.566675 -> 1.57
      expect(result.current.taxAmount).toBe(1.57);
    });

    it("should calculate tax for multiple items with different rates", () => {
      const items: CartItem[] = [
        createCartItem({
          id: "cart-1",
          totalPrice: 10.0,
          quantity: 1,
          taxes: [createTaxInfo({ rate: 0.0825 })],
        }),
        createCartItem({
          id: "cart-2",
          totalPrice: 10.0,
          quantity: 1,
          taxes: [createTaxInfo({ rate: 0.05, roundingMethod: "always_round_down" })],
        }),
      ];

      const { result } = renderHook(() => usePricing(items));

      // item-1: 10 * 0.0825 = 0.825 -> 0.83
      // item-2: 10 * 0.05 = 0.50 -> 0.50
      // total: 0.83 + 0.50 = 1.33
      expect(result.current.taxAmount).toBe(1.33);
    });

    it("should handle multiple taxes per item", () => {
      const items: CartItem[] = [
        createCartItem({
          totalPrice: 16.0, // 2 beers at $8 each
          quantity: 2,
          taxes: [
            createTaxInfo({ taxConfigId: "tax-standard", name: "Standard Tax", rate: 0.0825 }),
            createTaxInfo({ taxConfigId: "tax-alcohol", name: "Alcohol Tax", rate: 0.05 }),
          ],
        }),
      ];

      const { result } = renderHook(() => usePricing(items));

      // Standard tax: 8 * 0.0825 = 0.66 -> 0.66 (per unit, but calculated on total)
      // Alcohol tax: 8 * 0.05 = 0.40 -> 0.40
      // Actually: unitPrice = 16/2 = 8, so for quantity 2:
      // Standard: 16 * 0.0825 = 1.32
      // Alcohol: 16 * 0.05 = 0.80
      // Total: 1.32 + 0.80 = 2.12
      expect(result.current.taxAmount).toBe(2.12);
    });

    it("should return zero tax for items without taxes", () => {
      const items: CartItem[] = [
        createCartItem({
          totalPrice: 10.0,
          quantity: 1,
          taxes: [],
        }),
      ];

      const { result } = renderHook(() => usePricing(items));

      expect(result.current.taxAmount).toBe(0);
    });

    it("should handle undefined taxes", () => {
      const items: CartItem[] = [
        createCartItem({
          totalPrice: 10.0,
          quantity: 1,
          // taxes is undefined
        }),
      ];

      const { result } = renderHook(() => usePricing(items));

      expect(result.current.taxAmount).toBe(0);
    });

    it("should mix taxable and tax-free items", () => {
      const items: CartItem[] = [
        createCartItem({
          id: "cart-1",
          totalPrice: 10.0,
          quantity: 1,
          taxes: [createTaxInfo({ rate: 0.0825 })],
        }),
        createCartItem({
          id: "cart-2",
          totalPrice: 10.0,
          quantity: 1,
          taxes: [], // Tax-free item
        }),
      ];

      const { result } = renderHook(() => usePricing(items));

      // Only first item has tax: 10 * 0.0825 = 0.825 -> 0.83
      expect(result.current.taxAmount).toBe(0.83);
      expect(result.current.subtotal).toBe(20.0);
      expect(result.current.totalAmount).toBe(20.83);
    });
  });

  describe("tip calculation", () => {
    it("should add fixed tip to total", () => {
      const items: CartItem[] = [
        createCartItem({ totalPrice: 10.0, quantity: 1 }),
      ];

      const { result } = renderHook(() =>
        usePricing(items, { type: "fixed", amount: 5.0 })
      );

      expect(result.current.tipAmount).toBe(5.0);
      expect(result.current.totalAmount).toBe(15.0);
    });

    it("should calculate percentage tip based on subtotal", () => {
      const items: CartItem[] = [
        createCartItem({ totalPrice: 100.0, quantity: 1 }),
      ];

      const { result } = renderHook(() =>
        usePricing(items, { type: "percentage", percentage: 0.15 })
      );

      expect(result.current.tipAmount).toBe(15.0);
      expect(result.current.totalAmount).toBe(115.0);
    });

    it("should handle null tip", () => {
      const items: CartItem[] = [
        createCartItem({ totalPrice: 10.0, quantity: 1 }),
      ];

      const { result } = renderHook(() => usePricing(items, null));

      expect(result.current.tipAmount).toBe(0);
    });
  });

  describe("real-world scenarios", () => {
    it("should calculate a typical restaurant order", () => {
      const items: CartItem[] = [
        createCartItem({
          id: "cart-1",
          menuItemId: "pizza",
          name: "Classic Pizza",
          price: 18.99,
          totalPrice: 37.98, // 2 pizzas
          quantity: 2,
          taxes: [createTaxInfo({ rate: 0.0825 })],
        }),
        createCartItem({
          id: "cart-2",
          menuItemId: "beer",
          name: "Craft Beer",
          price: 8.0,
          totalPrice: 16.0, // 2 beers
          quantity: 2,
          taxes: [
            createTaxInfo({ taxConfigId: "tax-standard", rate: 0.0825 }),
            createTaxInfo({ taxConfigId: "tax-alcohol", rate: 0.05 }),
          ],
        }),
      ];

      const { result } = renderHook(() =>
        usePricing(items, { type: "percentage", percentage: 0.18 })
      );

      // Subtotal: 37.98 + 16.0 = 53.98
      expect(result.current.subtotal).toBe(53.98);

      // Pizza tax: 18.99 * 0.0825 = 1.566675 -> 1.57 (per-item)
      // For quantity 2: 18.99 * 2 * 0.0825 = 3.13335 -> 3.13
      // Beer standard: 8 * 2 * 0.0825 = 1.32
      // Beer alcohol: 8 * 2 * 0.05 = 0.80
      // Total tax: 3.13 + 1.32 + 0.80 = 5.25
      expect(result.current.taxAmount).toBe(5.25);

      // Tip: 53.98 * 0.18 = 9.7164 -> 9.72
      expect(result.current.tipAmount).toBe(9.72);

      // Total: 53.98 + 5.25 + 9.72 = 68.95
      expect(result.current.totalAmount).toBe(68.95);
    });

    it("should handle order with fees", () => {
      const items: CartItem[] = [
        createCartItem({
          totalPrice: 50.0,
          quantity: 1,
          taxes: [createTaxInfo({ rate: 0.08 })],
        }),
      ];

      const fees = [
        { id: "delivery", type: "fixed" as const, value: 5.0 },
        { id: "service", type: "percentage" as const, value: 0.03 },
      ];

      const { result } = renderHook(() =>
        usePricing(items, { type: "fixed", amount: 10.0 }, fees)
      );

      expect(result.current.subtotal).toBe(50.0);
      // Tax: 50 * 0.08 = 4.00
      expect(result.current.taxAmount).toBe(4.0);
      // Fees: 5.0 + (50 * 0.03) = 5.0 + 1.5 = 6.5
      expect(result.current.feesAmount).toBe(6.5);
      expect(result.current.tipAmount).toBe(10.0);
      // Total: 50 + 4 + 6.5 + 10 = 70.5
      expect(result.current.totalAmount).toBe(70.5);
    });
  });
});
