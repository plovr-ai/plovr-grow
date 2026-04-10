import { describe, it, expect } from "vitest";
import { AppError } from "../app-error";
import { ErrorCodes } from "../error-codes";

describe("AppError", () => {
  it("should create error with code and default statusCode", () => {
    const error = new AppError(ErrorCodes.ORDER_NOT_FOUND);

    expect(error.code).toBe("ORDER_NOT_FOUND");
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe("ORDER_NOT_FOUND");
    expect(error.name).toBe("AppError");
    expect(error.params).toBeUndefined();
  });

  it("should create error with params and custom statusCode", () => {
    const error = new AppError(
      ErrorCodes.MERCHANT_NOT_FOUND,
      { merchantId: "m1" },
      404
    );

    expect(error.code).toBe("MERCHANT_NOT_FOUND");
    expect(error.statusCode).toBe(404);
    expect(error.params).toEqual({ merchantId: "m1" });
  });

  it("should serialize to JSON with code and params", () => {
    const error = new AppError(
      ErrorCodes.ORDER_ALREADY_PAID,
      { orderId: "order-1" },
      409
    );

    const json = error.toJSON();

    expect(json).toEqual({
      code: "ORDER_ALREADY_PAID",
      params: { orderId: "order-1" },
    });
  });

  it("should serialize to JSON without params when none provided", () => {
    const error = new AppError(ErrorCodes.MENU_NOT_FOUND);

    const json = error.toJSON();

    expect(json).toEqual({
      code: "MENU_NOT_FOUND",
      params: undefined,
    });
  });

  it("should be an instance of Error", () => {
    const error = new AppError(ErrorCodes.AUTH_EMAIL_EXISTS);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it("should have a stack trace", () => {
    const error = new AppError(ErrorCodes.VALIDATION_FAILED);

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("AppError");
  });
});
