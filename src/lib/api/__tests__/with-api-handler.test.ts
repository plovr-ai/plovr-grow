import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "../with-api-handler";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCodes } from "@/lib/errors/error-codes";

const mockRequest = new NextRequest("http://localhost/api/test");
const mockContext = { params: Promise.resolve({}) };

describe("withApiHandler", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should pass through the response when handler succeeds", async () => {
    const body = { success: true, data: { id: "123" } };
    const handler = vi.fn().mockResolvedValue(NextResponse.json(body));

    const wrapped = withApiHandler(handler);
    const response = await wrapped(mockRequest, mockContext);
    const json = await response.json();

    expect(handler).toHaveBeenCalledWith(mockRequest, mockContext);
    expect(response.status).toBe(200);
    expect(json).toEqual(body);
  });

  it("should return error response when handler throws AppError", async () => {
    const handler = vi.fn().mockRejectedValue(
      new AppError(ErrorCodes.ORDER_NOT_FOUND)
    );

    const wrapped = withApiHandler(handler);
    const response = await wrapped(mockRequest, mockContext);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({
      success: false,
      error: { code: "ORDER_NOT_FOUND" },
    });
  });

  it("should include params when AppError has params", async () => {
    const handler = vi.fn().mockRejectedValue(
      new AppError(ErrorCodes.MERCHANT_NOT_FOUND, { merchantId: "m1" }, 404)
    );

    const wrapped = withApiHandler(handler);
    const response = await wrapped(mockRequest, mockContext);
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json).toEqual({
      success: false,
      error: {
        code: "MERCHANT_NOT_FOUND",
        params: { merchantId: "m1" },
      },
    });
  });

  it.each([
    { code: ErrorCodes.VALIDATION_FAILED, statusCode: 400 },
    { code: ErrorCodes.MENU_NOT_FOUND, statusCode: 404 },
    { code: ErrorCodes.ORDER_ALREADY_PAID, statusCode: 409 },
    { code: ErrorCodes.INTERNAL_ERROR, statusCode: 500 },
  ] as const)(
    "should respect custom statusCode $statusCode for $code",
    async ({ code, statusCode }) => {
      const handler = vi.fn().mockRejectedValue(
        new AppError(code, undefined, statusCode)
      );

      const wrapped = withApiHandler(handler);
      const response = await wrapped(mockRequest, mockContext);

      expect(response.status).toBe(statusCode);
    }
  );

  it("should return 500 with INTERNAL_ERROR when handler throws a generic Error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = vi.fn().mockRejectedValue(new Error("something broke"));

    const wrapped = withApiHandler(handler);
    const response = await wrapped(mockRequest, mockContext);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({
      success: false,
      error: { code: "INTERNAL_ERROR" },
    });

    consoleSpy.mockRestore();
  });

  it("should return 500 with INTERNAL_ERROR when handler throws a non-Error value", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = vi.fn().mockRejectedValue("string error");

    const wrapped = withApiHandler(handler);
    const response = await wrapped(mockRequest, mockContext);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({
      success: false,
      error: { code: "INTERNAL_ERROR" },
    });

    consoleSpy.mockRestore();
  });

  it("should call console.error for unhandled errors", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const thrownError = new Error("unexpected");
    const handler = vi.fn().mockRejectedValue(thrownError);

    const wrapped = withApiHandler(handler);
    await wrapped(mockRequest, mockContext);

    expect(consoleSpy).toHaveBeenCalledWith("Unhandled error:", thrownError);

    consoleSpy.mockRestore();
  });

  it("should not include params field when AppError has no params", async () => {
    const handler = vi.fn().mockRejectedValue(
      new AppError(ErrorCodes.CATEGORY_NOT_FOUND, undefined, 404)
    );

    const wrapped = withApiHandler(handler);
    const response = await wrapped(mockRequest, mockContext);
    const json = await response.json();

    expect(json.error).not.toHaveProperty("params");
    expect(json).toEqual({
      success: false,
      error: { code: "CATEGORY_NOT_FOUND" },
    });
  });
});
