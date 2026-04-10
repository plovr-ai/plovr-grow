import { describe, it, expect } from "vitest";
import {
  calculateOrderPricing,
  calculateTipAmount,
  type PricingItem,
  type TipInput,
} from "../pricing";

describe("calculateOrderPricing", () => {
  describe("subtotal calculation", () => {
    it("should calculate subtotal for single item", () => {
      const items: PricingItem[] = [
        { itemId: "item-1", unitPrice: 10.0, quantity: 1, taxes: [] },
      ];

      const result = calculateOrderPricing(items);

      expect(result.subtotal).toBe(10.0);
    });

    it("should calculate subtotal for multiple items", () => {
      const items: PricingItem[] = [
        { itemId: "item-1", unitPrice: 10.0, quantity: 2, taxes: [] },
        { itemId: "item-2", unitPrice: 5.0, quantity: 3, taxes: [] },
      ];

      const result = calculateOrderPricing(items);

      // 10 * 2 + 5 * 3 = 35
      expect(result.subtotal).toBe(35.0);
    });

    it("should handle empty items array", () => {
      const result = calculateOrderPricing([]);

      expect(result.subtotal).toBe(0);
      expect(result.taxAmount).toBe(0);
      expect(result.tipAmount).toBe(0);
      expect(result.totalAmount).toBe(0);
    });
  });

  describe("tax calculation with different rounding methods", () => {
    it("should calculate tax with half_up rounding", () => {
      const items: PricingItem[] = [
        {
          itemId: "item-1",
          unitPrice: 18.99,
          quantity: 1,
          taxes: [{ rate: 0.0825, roundingMethod: "half_up" }],
        },
      ];

      const result = calculateOrderPricing(items);

      // 18.99 * 0.0825 = 1.566675 -> 1.57 (half_up)
      expect(result.taxAmount).toBe(1.57);
    });

    it("should calculate tax with always_round_down rounding", () => {
      const items: PricingItem[] = [
        {
          itemId: "item-1",
          unitPrice: 10.99,
          quantity: 1,
          taxes: [{ rate: 0.05, roundingMethod: "always_round_down" }],
        },
      ];

      const result = calculateOrderPricing(items);

      // 10.99 * 0.05 = 0.5495 -> 0.54 (floor)
      expect(result.taxAmount).toBe(0.54);
    });

    it("should calculate tax with always_round_up rounding", () => {
      const items: PricingItem[] = [
        {
          itemId: "item-1",
          unitPrice: 10.01,
          quantity: 1,
          taxes: [{ rate: 0.05, roundingMethod: "always_round_up" }],
        },
      ];

      const result = calculateOrderPricing(items);

      // 10.01 * 0.05 = 0.5005 -> 0.51 (ceiling)
      expect(result.taxAmount).toBe(0.51);
    });

    it("should calculate tax with half_even (banker's) rounding", () => {
      const items: PricingItem[] = [
        {
          itemId: "item-1",
          unitPrice: 100.0,
          quantity: 1,
          taxes: [{ rate: 0.00125, roundingMethod: "half_even" }],
        },
      ];

      const result = calculateOrderPricing(items);

      // 100 * 0.00125 = 0.125 -> 0.12 (half_even rounds to even)
      expect(result.taxAmount).toBe(0.12);
    });
  });

  describe("per-item tax calculation", () => {
    it("should calculate tax per-item and sum", () => {
      const items: PricingItem[] = [
        {
          itemId: "item-1",
          unitPrice: 18.99,
          quantity: 1,
          taxes: [{ rate: 0.0825, roundingMethod: "half_up" }],
        },
        {
          itemId: "item-2",
          unitPrice: 21.99,
          quantity: 2,
          taxes: [{ rate: 0.0825, roundingMethod: "half_up" }],
        },
      ];

      const result = calculateOrderPricing(items);

      // item-1: 18.99 * 0.0825 = 1.566675 -> 1.57
      // item-2: 21.99 * 2 * 0.0825 = 3.628350 -> 3.63
      // total: 1.57 + 3.63 = 5.20
      expect(result.taxAmount).toBe(5.2);
    });

    it("should handle mixed tax rates", () => {
      const items: PricingItem[] = [
        {
          itemId: "item-1",
          unitPrice: 10.0,
          quantity: 1,
          taxes: [{ rate: 0.0825, roundingMethod: "half_up" }],
        },
        {
          itemId: "item-2",
          unitPrice: 10.0,
          quantity: 1,
          taxes: [{ rate: 0.05, roundingMethod: "always_round_down" }],
        },
      ];

      const result = calculateOrderPricing(items);

      // item-1: 10 * 0.0825 = 0.825 -> 0.83
      // item-2: 10 * 0.05 = 0.50 -> 0.50
      // total: 0.83 + 0.50 = 1.33
      expect(result.taxAmount).toBe(1.33);
    });
  });

  describe("multiple taxes per item", () => {
    it("should calculate multiple taxes for a single item", () => {
      const items: PricingItem[] = [
        {
          itemId: "item-1",
          unitPrice: 100.0,
          quantity: 1,
          taxes: [
            { rate: 0.08, roundingMethod: "half_up" }, // Standard tax
            { rate: 0.02, roundingMethod: "half_up" }, // Additional tax
          ],
        },
      ];

      const result = calculateOrderPricing(items);

      // Standard tax: 100 * 0.08 = 8.00
      // Additional tax: 100 * 0.02 = 2.00
      // Total: 8.00 + 2.00 = 10.00
      expect(result.taxAmount).toBe(10.0);
      expect(result.totalAmount).toBe(110.0);
    });

    it("should handle alcohol tax scenario", () => {
      const items: PricingItem[] = [
        {
          itemId: "beer",
          unitPrice: 8.0,
          quantity: 2,
          taxes: [
            { rate: 0.0825, roundingMethod: "half_up" }, // Standard tax
            { rate: 0.05, roundingMethod: "half_up" }, // Alcohol tax
          ],
        },
      ];

      const result = calculateOrderPricing(items);

      // Standard tax: 16 * 0.0825 = 1.32
      // Alcohol tax: 16 * 0.05 = 0.80
      // Total tax: 1.32 + 0.80 = 2.12
      expect(result.taxAmount).toBe(2.12);
    });
  });

  describe("tax-free items", () => {
    it("should return zero tax for items with empty taxes array", () => {
      const items: PricingItem[] = [
        { itemId: "item-1", unitPrice: 10.0, quantity: 1, taxes: [] },
        { itemId: "item-2", unitPrice: 20.0, quantity: 1, taxes: [] },
      ];

      const result = calculateOrderPricing(items);

      expect(result.subtotal).toBe(30.0);
      expect(result.taxAmount).toBe(0);
      expect(result.totalAmount).toBe(30.0);
    });

    it("should handle mix of taxable and tax-free items", () => {
      const items: PricingItem[] = [
        {
          itemId: "item-1",
          unitPrice: 10.0,
          quantity: 1,
          taxes: [{ rate: 0.0825, roundingMethod: "half_up" }],
        },
        { itemId: "item-2", unitPrice: 10.0, quantity: 1, taxes: [] },
      ];

      const result = calculateOrderPricing(items);

      // Only item-1 has tax: 10 * 0.0825 = 0.825 -> 0.83
      expect(result.subtotal).toBe(20.0);
      expect(result.taxAmount).toBe(0.83);
      expect(result.totalAmount).toBe(20.83);
    });
  });

  describe("tip calculation", () => {
    it("should include fixed tip in total amount", () => {
      const items: PricingItem[] = [
        { itemId: "item-1", unitPrice: 10.0, quantity: 1, taxes: [] },
      ];

      const result = calculateOrderPricing(items, { type: "fixed", amount: 5.0 });

      expect(result.subtotal).toBe(10.0);
      expect(result.tipAmount).toBe(5.0);
      expect(result.totalAmount).toBe(15.0);
    });

    it("should calculate percentage tip based on subtotal", () => {
      const items: PricingItem[] = [
        { itemId: "item-1", unitPrice: 100.0, quantity: 1, taxes: [] },
      ];

      // 15% tip
      const result = calculateOrderPricing(items, { type: "percentage", percentage: 0.15 });

      expect(result.subtotal).toBe(100.0);
      expect(result.tipAmount).toBe(15.0); // 100 * 0.15 = 15
      expect(result.totalAmount).toBe(115.0);
    });

    it("should calculate percentage tip with proper rounding", () => {
      const items: PricingItem[] = [
        { itemId: "item-1", unitPrice: 33.33, quantity: 1, taxes: [] },
      ];

      // 18% tip
      const result = calculateOrderPricing(items, { type: "percentage", percentage: 0.18 });

      expect(result.subtotal).toBe(33.33);
      // 33.33 * 0.18 = 5.9994 -> 6.00
      expect(result.tipAmount).toBe(6.0);
      expect(result.totalAmount).toBe(39.33);
    });

    it("should handle tip with tax", () => {
      const items: PricingItem[] = [
        {
          itemId: "item-1",
          unitPrice: 10.0,
          quantity: 1,
          taxes: [{ rate: 0.0825, roundingMethod: "half_up" }],
        },
      ];

      const result = calculateOrderPricing(items, { type: "fixed", amount: 2.0 });

      // subtotal: 10.0
      // tax: 10 * 0.0825 = 0.825 -> 0.83
      // tip: 2.0
      // total: 10 + 0.83 + 2 = 12.83
      expect(result.subtotal).toBe(10.0);
      expect(result.taxAmount).toBe(0.83);
      expect(result.tipAmount).toBe(2.0);
      expect(result.totalAmount).toBe(12.83);
    });

    it("should default tip to 0 when not provided", () => {
      const items: PricingItem[] = [
        { itemId: "item-1", unitPrice: 10.0, quantity: 1, taxes: [] },
      ];

      const result = calculateOrderPricing(items);

      expect(result.tipAmount).toBe(0);
    });

    it("should default tip to 0 when null is provided", () => {
      const items: PricingItem[] = [
        { itemId: "item-1", unitPrice: 10.0, quantity: 1, taxes: [] },
      ];

      const result = calculateOrderPricing(items, null);

      expect(result.tipAmount).toBe(0);
    });
  });

  describe("calculateTipAmount", () => {
    it("should calculate fixed tip amount", () => {
      const tip: TipInput = { type: "fixed", amount: 5.0 };
      expect(calculateTipAmount(100.0, tip)).toBe(5.0);
    });

    it("should calculate percentage tip based on subtotal", () => {
      const tip: TipInput = { type: "percentage", percentage: 0.15 };
      expect(calculateTipAmount(100.0, tip)).toBe(15.0);
    });

    it("should round percentage tip to 2 decimal places", () => {
      const tip: TipInput = { type: "percentage", percentage: 0.18 };
      // 33.33 * 0.18 = 5.9994 -> 6.00
      expect(calculateTipAmount(33.33, tip)).toBe(6.0);
    });

    it("should return 0 for null tip", () => {
      expect(calculateTipAmount(100.0, null)).toBe(0);
    });

    it("should return 0 for undefined tip", () => {
      expect(calculateTipAmount(100.0, undefined)).toBe(0);
    });
  });

  describe("fees calculation", () => {
    it("should calculate percentage fee based on subtotal", () => {
      const items: PricingItem[] = [
        { itemId: "item-1", unitPrice: 100.0, quantity: 1, taxes: [] },
      ];

      const result = calculateOrderPricing(items, null, [
        { id: "service-fee", type: "percentage", value: 0.05 },
      ]);

      expect(result.feesAmount).toBe(5.0);
      expect(result.feesBreakdown).toEqual([{ id: "service-fee", amount: 5.0 }]);
      expect(result.totalAmount).toBe(105.0);
    });

    it("should calculate fixed fee", () => {
      const items: PricingItem[] = [
        { itemId: "item-1", unitPrice: 50.0, quantity: 1, taxes: [] },
      ];

      const result = calculateOrderPricing(items, null, [
        { id: "delivery-fee", type: "fixed", value: 3.99 },
      ]);

      expect(result.feesAmount).toBe(3.99);
      expect(result.totalAmount).toBe(53.99);
    });
  });

  describe("real-world scenarios", () => {
    it("should calculate a typical restaurant order with fixed tip", () => {
      // Simulate a real order:
      // - 2x Classic Pizza @ $18.99 (standard tax 8.25%)
      // - 1x Fountain Drink @ $2.99 (reduced tax 5%)
      // - $5 fixed tip
      const items: PricingItem[] = [
        {
          itemId: "pizza",
          unitPrice: 18.99,
          quantity: 2,
          taxes: [{ rate: 0.0825, roundingMethod: "half_up" }],
        },
        {
          itemId: "drink",
          unitPrice: 2.99,
          quantity: 1,
          taxes: [{ rate: 0.05, roundingMethod: "always_round_down" }],
        },
      ];

      const result = calculateOrderPricing(items, { type: "fixed", amount: 5.0 });

      // subtotal: 18.99 * 2 + 2.99 = 40.97
      // pizza tax: 18.99 * 2 * 0.0825 = 3.133350 -> 3.13
      // drink tax: 2.99 * 0.05 = 0.1495 -> 0.14
      // total tax: 3.13 + 0.14 = 3.27
      // total: 40.97 + 3.27 + 5.0 = 49.24
      expect(result.subtotal).toBe(40.97);
      expect(result.taxAmount).toBe(3.27);
      expect(result.tipAmount).toBe(5.0);
      expect(result.totalAmount).toBe(49.24);
    });

    it("should calculate a typical restaurant order with percentage tip", () => {
      // Simulate a real order with 18% tip
      const items: PricingItem[] = [
        {
          itemId: "pizza",
          unitPrice: 18.99,
          quantity: 2,
          taxes: [{ rate: 0.0825, roundingMethod: "half_up" }],
        },
        {
          itemId: "drink",
          unitPrice: 2.99,
          quantity: 1,
          taxes: [{ rate: 0.05, roundingMethod: "always_round_down" }],
        },
      ];

      const result = calculateOrderPricing(items, { type: "percentage", percentage: 0.18 });

      // subtotal: 18.99 * 2 + 2.99 = 40.97
      // pizza tax: 18.99 * 2 * 0.0825 = 3.133350 -> 3.13
      // drink tax: 2.99 * 0.05 = 0.1495 -> 0.14
      // total tax: 3.13 + 0.14 = 3.27
      // tip: 40.97 * 0.18 = 7.3746 -> 7.37
      // total: 40.97 + 3.27 + 7.37 = 51.61
      expect(result.subtotal).toBe(40.97);
      expect(result.taxAmount).toBe(3.27);
      expect(result.tipAmount).toBe(7.37);
      expect(result.totalAmount).toBe(51.61);
    });

    it("should handle floating point precision correctly", () => {
      // Test case that would cause floating point issues without proper rounding
      const items: PricingItem[] = [
        {
          itemId: "item-1",
          unitPrice: 18.99,
          quantity: 5,
          taxes: [{ rate: 0.0825, roundingMethod: "half_up" }],
        },
      ];

      const result = calculateOrderPricing(items);

      // subtotal: 18.99 * 5 = 94.95 (could be 94.94999999999999 without rounding)
      // tax: 94.95 * 0.0825 = 7.833375 -> 7.83
      expect(result.subtotal).toBe(94.95);
      expect(result.taxAmount).toBe(7.83);
      expect(result.totalAmount).toBe(102.78);
    });

    it("should calculate order with multiple taxes per item", () => {
      // Simulate an order with alcohol (has both standard and alcohol tax)
      const items: PricingItem[] = [
        {
          itemId: "pizza",
          unitPrice: 18.99,
          quantity: 1,
          taxes: [{ rate: 0.0825, roundingMethod: "half_up" }],
        },
        {
          itemId: "beer",
          unitPrice: 8.0,
          quantity: 2,
          taxes: [
            { rate: 0.0825, roundingMethod: "half_up" }, // Standard tax
            { rate: 0.05, roundingMethod: "half_up" }, // Alcohol tax
          ],
        },
      ];

      const result = calculateOrderPricing(items, { type: "percentage", percentage: 0.15 });

      // subtotal: 18.99 + 16 = 34.99
      // pizza tax: 18.99 * 0.0825 = 1.566675 -> 1.57
      // beer standard tax: 16 * 0.0825 = 1.32
      // beer alcohol tax: 16 * 0.05 = 0.80
      // total tax: 1.57 + 1.32 + 0.80 = 3.69
      // tip: 34.99 * 0.15 = 5.2485 -> 5.25
      // total: 34.99 + 3.69 + 5.25 = 43.93
      expect(result.subtotal).toBe(34.99);
      expect(result.taxAmount).toBe(3.69);
      expect(result.tipAmount).toBe(5.25);
      expect(result.totalAmount).toBe(43.93);
    });
  });

  describe("edge cases", () => {
    it("should handle item with undefined taxes gracefully", () => {
      const items = [
        { itemId: "item-1", unitPrice: 10.0, quantity: 1, taxes: undefined as unknown as never[] },
      ];

      const result = calculateOrderPricing(items);

      expect(result.subtotal).toBe(10.0);
      expect(result.taxAmount).toBe(0);
    });
  });
});
