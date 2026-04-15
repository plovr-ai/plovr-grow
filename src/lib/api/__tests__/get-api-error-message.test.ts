import { describe, it, expect } from "vitest";
import { getApiErrorMessage } from "../get-api-error-message";

describe("getApiErrorMessage", () => {
  describe("string error (legacy format)", () => {
    it("should return the string as-is", () => {
      expect(getApiErrorMessage("Card number is required")).toBe(
        "Card number is required"
      );
    });

    it("should return empty string as-is", () => {
      expect(getApiErrorMessage("")).toBe("");
    });
  });

  describe("object error with code (new format)", () => {
    it("should return translated message for known error code", () => {
      expect(getApiErrorMessage({ code: "INTERNAL_ERROR" })).toBe(
        "An unexpected error occurred. Please try again."
      );
    });

    it("should return translated message for GIFTCARD_NOT_FOUND", () => {
      expect(getApiErrorMessage({ code: "GIFTCARD_NOT_FOUND" })).toBe(
        "Gift card not found"
      );
    });

    it("should return translated message for ORDER_NOT_FOUND", () => {
      expect(getApiErrorMessage({ code: "ORDER_NOT_FOUND" })).toBe(
        "Order not found"
      );
    });

    it("should return fallback for unknown error code", () => {
      expect(
        getApiErrorMessage({ code: "UNKNOWN_CODE" }, "Something went wrong")
      ).toBe("Something went wrong");
    });

    it("should return code as last resort if no fallback provided", () => {
      expect(getApiErrorMessage({ code: "UNKNOWN_CODE" })).toBe(
        "UNKNOWN_CODE"
      );
    });

    it("should handle error with params (params are not interpolated)", () => {
      const error = {
        code: "INVALID_PLAN_CODE",
        params: { planCode: "premium" },
      };
      // Returns the template string - interpolation is the caller's responsibility
      expect(getApiErrorMessage(error)).toBe(
        "Invalid plan code: {planCode}"
      );
    });
  });

  describe("null/undefined error", () => {
    it("should return fallback for null", () => {
      expect(getApiErrorMessage(null, "Fallback message")).toBe(
        "Fallback message"
      );
    });

    it("should return fallback for undefined", () => {
      expect(getApiErrorMessage(undefined, "Fallback message")).toBe(
        "Fallback message"
      );
    });

    it("should return default message when no fallback provided", () => {
      expect(getApiErrorMessage(null)).toBe(
        "An unexpected error occurred. Please try again."
      );
    });
  });

  describe("unexpected types", () => {
    it("should return fallback for number", () => {
      expect(getApiErrorMessage(42, "Fallback")).toBe("Fallback");
    });

    it("should return fallback for boolean", () => {
      expect(getApiErrorMessage(true, "Fallback")).toBe("Fallback");
    });

    it("should return fallback for object without code", () => {
      expect(getApiErrorMessage({ message: "oops" }, "Fallback")).toBe(
        "Fallback"
      );
    });

    it("should return fallback for array", () => {
      expect(getApiErrorMessage(["error"], "Fallback")).toBe("Fallback");
    });
  });
});
