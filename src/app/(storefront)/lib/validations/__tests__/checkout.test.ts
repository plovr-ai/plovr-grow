import { describe, it, expect } from "vitest";
import { checkoutFormSchema, deliveryAddressSchema } from "../checkout";

describe("checkoutFormSchema", () => {
  const validBase = {
    orderMode: "pickup" as const,
    customerFirstName: "John",
    customerLastName: "Doe",
    customerPhone: "(415) 555-1234",
  };

  it("should validate a valid pickup order", () => {
    const result = checkoutFormSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it("should require delivery address for delivery orders", () => {
    const result = checkoutFormSchema.safeParse({
      ...validBase,
      orderMode: "delivery",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("deliveryAddress");
    }
  });

  it("should accept delivery order with valid address", () => {
    const result = checkoutFormSchema.safeParse({
      ...validBase,
      orderMode: "delivery",
      deliveryAddress: {
        street: "123 Main St",
        city: "San Francisco",
        state: "CA",
        zipCode: "94102",
      },
    });
    expect(result.success).toBe(true);
  });

  it("should accept dine_in order without delivery address", () => {
    const result = checkoutFormSchema.safeParse({
      ...validBase,
      orderMode: "dine_in",
    });
    expect(result.success).toBe(true);
  });
});

describe("deliveryAddressSchema", () => {
  it("should validate a valid address", () => {
    const result = deliveryAddressSchema.safeParse({
      street: "123 Main St",
      city: "San Francisco",
      state: "CA",
      zipCode: "94102",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid zip code", () => {
    const result = deliveryAddressSchema.safeParse({
      street: "123 Main St",
      city: "San Francisco",
      state: "CA",
      zipCode: "abc",
    });
    expect(result.success).toBe(false);
  });
});
