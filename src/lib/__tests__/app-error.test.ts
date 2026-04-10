import { describe, it, expect } from "vitest";
import { AppError } from "../errors/app-error";

describe("AppError", () => {
  it("should serialize to JSON with code and params", () => {
    const error = new AppError("VALIDATION_FAILED" as never, { field: "name" });
    const json = error.toJSON();

    expect(json.code).toBe("VALIDATION_FAILED");
    expect(json.params).toEqual({ field: "name" });
  });

  it("should use default statusCode of 400", () => {
    const error = new AppError("VALIDATION_FAILED" as never);
    expect(error.statusCode).toBe(400);
  });

  it("should accept custom statusCode", () => {
    const error = new AppError("MERCHANT_NOT_FOUND" as never, undefined, 404);
    expect(error.statusCode).toBe(404);
    expect(error.params).toBeUndefined();
  });

  it("should set name to AppError", () => {
    const error = new AppError("VALIDATION_FAILED" as never);
    expect(error.name).toBe("AppError");
  });
});
