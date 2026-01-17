import { describe, it, expect } from "vitest";
import {
  applyRounding,
  calculateItemTax,
  calculateOrderTax,
} from "../tax";
import type { TaxConfigData } from "@/services/menu/tax-config.types";

describe("applyRounding", () => {
  describe("half_up (standard rounding)", () => {
    it("should round 0.124 to 0.12", () => {
      expect(applyRounding(0.124, "half_up")).toBe(0.12);
    });

    it("should round 0.125 to 0.13 (half rounds up)", () => {
      expect(applyRounding(0.125, "half_up")).toBe(0.13);
    });

    it("should round 0.126 to 0.13", () => {
      expect(applyRounding(0.126, "half_up")).toBe(0.13);
    });

    it("should round 1.565 to 1.57", () => {
      expect(applyRounding(1.565, "half_up")).toBe(1.57);
    });
  });

  describe("half_even (banker's rounding)", () => {
    it("should round 0.125 to 0.12 (even)", () => {
      expect(applyRounding(0.125, "half_even")).toBe(0.12);
    });

    it("should round 0.135 to 0.14 (even)", () => {
      expect(applyRounding(0.135, "half_even")).toBe(0.14);
    });

    it("should round 0.145 to 0.14 (even)", () => {
      expect(applyRounding(0.145, "half_even")).toBe(0.14);
    });

    it("should round 0.155 to 0.16 (even)", () => {
      expect(applyRounding(0.155, "half_even")).toBe(0.16);
    });

    it("should round 0.126 to 0.13 (not exactly 0.5)", () => {
      expect(applyRounding(0.126, "half_even")).toBe(0.13);
    });
  });

  describe("always_round_up (ceiling)", () => {
    it("should round 0.121 to 0.13", () => {
      expect(applyRounding(0.121, "always_round_up")).toBe(0.13);
    });

    it("should round 0.129 to 0.13", () => {
      expect(applyRounding(0.129, "always_round_up")).toBe(0.13);
    });

    it("should keep 0.12 as 0.12", () => {
      expect(applyRounding(0.12, "always_round_up")).toBe(0.12);
    });

    it("should round 1.001 to 1.01", () => {
      expect(applyRounding(1.001, "always_round_up")).toBe(1.01);
    });
  });

  describe("always_round_down (floor)", () => {
    it("should round 0.129 to 0.12", () => {
      expect(applyRounding(0.129, "always_round_down")).toBe(0.12);
    });

    it("should round 0.121 to 0.12", () => {
      expect(applyRounding(0.121, "always_round_down")).toBe(0.12);
    });

    it("should keep 0.12 as 0.12", () => {
      expect(applyRounding(0.12, "always_round_down")).toBe(0.12);
    });

    it("should round 1.999 to 1.99", () => {
      expect(applyRounding(1.999, "always_round_down")).toBe(1.99);
    });
  });
});

describe("calculateItemTax", () => {
  const standardTax: TaxConfigData = {
    id: "tax-standard",
    name: "Standard Tax",
    rate: 0.0825,
    roundingMethod: "half_up",
    isDefault: true,
    status: "active",
  };

  const reducedTax: TaxConfigData = {
    id: "tax-reduced",
    name: "Reduced Tax",
    rate: 0.05,
    roundingMethod: "always_round_down",
    isDefault: false,
    status: "active",
  };

  it("should calculate tax for a single item", () => {
    const result = calculateItemTax("item-1", 10.0, 1, standardTax);

    expect(result.itemId).toBe("item-1");
    expect(result.taxableAmount).toBe(10.0);
    expect(result.taxRate).toBe(0.0825);
    expect(result.taxAmount).toBe(0.83); // 10 * 0.0825 = 0.825 -> 0.83
    expect(result.taxConfigId).toBe("tax-standard");
    expect(result.taxConfigName).toBe("Standard Tax");
  });

  it("should calculate tax for multiple quantities", () => {
    const result = calculateItemTax("item-1", 10.0, 3, standardTax);

    expect(result.taxableAmount).toBe(30.0);
    expect(result.taxAmount).toBe(2.48); // 30 * 0.0825 = 2.475 -> 2.48
  });

  it("should return zero tax for null tax config", () => {
    const result = calculateItemTax("item-1", 10.0, 1, null);

    expect(result.taxAmount).toBe(0);
    expect(result.taxRate).toBe(0);
    expect(result.taxConfigId).toBeNull();
    expect(result.taxConfigName).toBeNull();
  });

  it("should use the correct rounding method from tax config", () => {
    // Using reduced tax with always_round_down
    const result = calculateItemTax("item-1", 10.0, 1, reducedTax);

    expect(result.taxRate).toBe(0.05);
    expect(result.taxAmount).toBe(0.5); // 10 * 0.05 = 0.5 (no rounding needed)

    // Test with a value that needs rounding
    const result2 = calculateItemTax("item-2", 10.99, 1, reducedTax);
    // 10.99 * 0.05 = 0.5495 -> 0.54 (floor)
    expect(result2.taxAmount).toBe(0.54);
  });
});

describe("calculateOrderTax", () => {
  const standardTax: TaxConfigData = {
    id: "tax-standard",
    name: "Standard Tax",
    rate: 0.0825,
    roundingMethod: "half_up",
    isDefault: true,
    status: "active",
  };

  const reducedTax: TaxConfigData = {
    id: "tax-reduced",
    name: "Reduced Tax",
    rate: 0.05,
    roundingMethod: "always_round_down",
    isDefault: false,
    status: "active",
  };

  it("should calculate total tax for multiple items", () => {
    const items = [
      { itemId: "item-1", unitPrice: 18.99, quantity: 1, taxConfig: standardTax },
      { itemId: "item-2", unitPrice: 21.99, quantity: 2, taxConfig: standardTax },
    ];

    const result = calculateOrderTax(items);

    // item-1: 18.99 * 0.0825 = 1.566675 -> 1.57
    // item-2: 21.99 * 2 * 0.0825 = 3.628350 -> 3.63
    // total: 1.57 + 3.63 = 5.20
    expect(result.totalTaxAmount).toBe(5.2);
    expect(result.itemTaxes).toHaveLength(2);
  });

  it("should group tax breakdown by tax config", () => {
    const items = [
      { itemId: "item-1", unitPrice: 10.0, quantity: 1, taxConfig: standardTax },
      { itemId: "item-2", unitPrice: 10.0, quantity: 1, taxConfig: reducedTax },
      { itemId: "item-3", unitPrice: 10.0, quantity: 1, taxConfig: standardTax },
    ];

    const result = calculateOrderTax(items);

    expect(result.taxBreakdown).toHaveLength(2);

    const standardBreakdown = result.taxBreakdown.find(
      (b) => b.taxConfigId === "tax-standard"
    );
    const reducedBreakdown = result.taxBreakdown.find(
      (b) => b.taxConfigId === "tax-reduced"
    );

    expect(standardBreakdown).toBeDefined();
    expect(standardBreakdown!.taxableAmount).toBe(20.0);
    expect(standardBreakdown!.taxAmount).toBe(1.66); // 0.83 + 0.83

    expect(reducedBreakdown).toBeDefined();
    expect(reducedBreakdown!.taxableAmount).toBe(10.0);
    expect(reducedBreakdown!.taxAmount).toBe(0.5);
  });

  it("should handle items without tax config (tax-free)", () => {
    const items = [
      { itemId: "item-1", unitPrice: 10.0, quantity: 1, taxConfig: standardTax },
      { itemId: "item-2", unitPrice: 10.0, quantity: 1, taxConfig: null },
    ];

    const result = calculateOrderTax(items);

    expect(result.totalTaxAmount).toBe(0.83); // Only item-1 has tax

    const taxFreeBreakdown = result.taxBreakdown.find(
      (b) => b.taxConfigId === null
    );
    expect(taxFreeBreakdown).toBeDefined();
    expect(taxFreeBreakdown!.taxConfigName).toBe("Tax-Free");
    expect(taxFreeBreakdown!.taxAmount).toBe(0);
  });

  it("should handle empty items array", () => {
    const result = calculateOrderTax([]);

    expect(result.totalTaxAmount).toBe(0);
    expect(result.itemTaxes).toHaveLength(0);
    expect(result.taxBreakdown).toHaveLength(0);
  });

  it("should handle real-world order scenario", () => {
    // Simulate a real order:
    // - 2x Classic Pizza @ $18.99 (standard tax)
    // - 1x Fountain Drink @ $2.99 (reduced tax)
    const items = [
      { itemId: "pizza", unitPrice: 18.99, quantity: 2, taxConfig: standardTax },
      { itemId: "drink", unitPrice: 2.99, quantity: 1, taxConfig: reducedTax },
    ];

    const result = calculateOrderTax(items);

    // Pizza: 18.99 * 2 * 0.0825 = 3.133350 -> 3.13
    // Drink: 2.99 * 0.05 = 0.1495 -> 0.14 (floor)
    // Total: 3.13 + 0.14 = 3.27
    expect(result.totalTaxAmount).toBe(3.27);
  });
});
