import { describe, it, expect } from "vitest";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  claimSchema,
} from "../auth";

describe("Auth Validation Schemas", () => {
  describe("loginSchema", () => {
    it("should accept valid login data", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
        password: "password123",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid email", () => {
      const result = loginSchema.safeParse({
        email: "not-an-email",
        password: "password123",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty password", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
        password: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("registerSchema", () => {
    const validData = {
      name: "John Doe",
      email: "john@example.com",
      password: "Password1",
      confirmPassword: "Password1",
      companyName: "Joe's Pizza",
    };

    it("should accept valid registration data", () => {
      const result = registerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject when passwords do not match", () => {
      const result = registerSchema.safeParse({
        ...validData,
        confirmPassword: "Different1",
      });
      expect(result.success).toBe(false);
    });

    it("should reject password without uppercase", () => {
      const result = registerSchema.safeParse({
        ...validData,
        password: "password1",
        confirmPassword: "password1",
      });
      expect(result.success).toBe(false);
    });

    it("should reject password without lowercase", () => {
      const result = registerSchema.safeParse({
        ...validData,
        password: "PASSWORD1",
        confirmPassword: "PASSWORD1",
      });
      expect(result.success).toBe(false);
    });

    it("should reject password without number", () => {
      const result = registerSchema.safeParse({
        ...validData,
        password: "PasswordNoNum",
        confirmPassword: "PasswordNoNum",
      });
      expect(result.success).toBe(false);
    });

    it("should reject password shorter than 8 characters", () => {
      const result = registerSchema.safeParse({
        ...validData,
        password: "Pass1",
        confirmPassword: "Pass1",
      });
      expect(result.success).toBe(false);
    });

    it("should reject name shorter than 2 characters", () => {
      const result = registerSchema.safeParse({
        ...validData,
        name: "J",
      });
      expect(result.success).toBe(false);
    });

    it("should reject company name shorter than 2 characters", () => {
      const result = registerSchema.safeParse({
        ...validData,
        companyName: "J",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("forgotPasswordSchema", () => {
    it("should accept valid email", () => {
      const result = forgotPasswordSchema.safeParse({
        email: "test@example.com",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid email", () => {
      const result = forgotPasswordSchema.safeParse({
        email: "bad",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("resetPasswordSchema", () => {
    it("should accept valid reset data", () => {
      const result = resetPasswordSchema.safeParse({
        token: "valid-token",
        password: "NewPass1a",
        confirmPassword: "NewPass1a",
      });
      expect(result.success).toBe(true);
    });

    it("should reject mismatched passwords", () => {
      const result = resetPasswordSchema.safeParse({
        token: "valid-token",
        password: "NewPass1a",
        confirmPassword: "Different1a",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty token", () => {
      const result = resetPasswordSchema.safeParse({
        token: "",
        password: "NewPass1a",
        confirmPassword: "NewPass1a",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("claimSchema", () => {
    it("should accept valid claim data", () => {
      const result = claimSchema.safeParse({
        name: "John Doe",
        email: "john@example.com",
        password: "Password1",
        confirmPassword: "Password1",
      });
      expect(result.success).toBe(true);
    });

    it("should reject mismatched passwords", () => {
      const result = claimSchema.safeParse({
        name: "John Doe",
        email: "john@example.com",
        password: "Password1",
        confirmPassword: "Different1",
      });
      expect(result.success).toBe(false);
    });
  });
});
