import { describe, it, expect } from "vitest";
import { claimSchema } from "../auth";

describe("Auth Validation Schemas", () => {
  describe("claimSchema", () => {
    it("should accept valid claim data", () => {
      const result = claimSchema.safeParse({
        name: "John Doe",
        email: "john@example.com",
      });
      expect(result.success).toBe(true);
    });

    it("should reject name shorter than 2 characters", () => {
      const result = claimSchema.safeParse({
        name: "J",
        email: "john@example.com",
      });
      expect(result.success).toBe(false);
    });

    it("should reject name longer than 100 characters", () => {
      const result = claimSchema.safeParse({
        name: "A".repeat(101),
        email: "john@example.com",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid email", () => {
      const result = claimSchema.safeParse({
        name: "John Doe",
        email: "not-an-email",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing name", () => {
      const result = claimSchema.safeParse({
        email: "john@example.com",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing email", () => {
      const result = claimSchema.safeParse({
        name: "John Doe",
      });
      expect(result.success).toBe(false);
    });
  });
});
