import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

// Mock services
vi.mock("@/services/merchant", () => ({
  merchantService: {
    getMerchantById: vi.fn(),
  },
}));

vi.mock("@/services/order", () => ({
  orderService: {
    markCashOrderPaid: vi.fn(),
  },
}));

import { merchantService } from "@/services/merchant";
import { orderService } from "@/services/order";
import { AppError } from "@/lib/errors";

const mockMerchantService = vi.mocked(merchantService);
const mockOrderService = vi.mocked(orderService);

describe("POST /api/dashboard/[merchantId]/orders/[orderId]/mark-paid", () => {
  const mockMerchant = {
    id: "merchant-1",
    name: "Test Merchant",
    tenant: {
      id: "tenant-1",
      tenantId: "tenant-1",
    },
  };

  const params = Promise.resolve({
    merchantId: "merchant-1",
    orderId: "order-1",
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createRequest(body: Record<string, unknown>) {
    return new NextRequest(
      "http://localhost:3000/api/dashboard/merchant-1/orders/order-1/mark-paid",
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );
  }

  it("should mark order as paid successfully", async () => {
    mockMerchantService.getMerchantById.mockResolvedValue(mockMerchant as never);
    mockOrderService.markCashOrderPaid.mockResolvedValue(undefined);

    const request = createRequest({});
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockOrderService.markCashOrderPaid).toHaveBeenCalledWith(
      "tenant-1",
      "order-1",
      {}
    );
  });

  it("should pass amount and notes to service", async () => {
    mockMerchantService.getMerchantById.mockResolvedValue(mockMerchant as never);
    mockOrderService.markCashOrderPaid.mockResolvedValue(undefined);

    const request = createRequest({ amount: 50, notes: "Cash payment" });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockOrderService.markCashOrderPaid).toHaveBeenCalledWith(
      "tenant-1",
      "order-1",
      { amount: 50, notes: "Cash payment" }
    );
  });

  it("should return 404 if merchant not found", async () => {
    mockMerchantService.getMerchantById.mockResolvedValue(null as never);

    const request = createRequest({});
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
  });

  it("should return 400 for invalid JSON", async () => {
    mockMerchantService.getMerchantById.mockResolvedValue(mockMerchant as never);

    const request = new NextRequest(
      "http://localhost:3000/api/dashboard/merchant-1/orders/order-1/mark-paid",
      {
        method: "POST",
        body: "not json",
        headers: { "Content-Type": "application/json" },
      }
    );
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid JSON");
  });

  it("should return 400 for invalid amount", async () => {
    mockMerchantService.getMerchantById.mockResolvedValue(mockMerchant as never);

    const request = createRequest({ amount: -10 });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("should return 404 for ORDER_NOT_FOUND AppError", async () => {
    mockMerchantService.getMerchantById.mockResolvedValue(mockMerchant as never);
    mockOrderService.markCashOrderPaid.mockRejectedValue(
      new AppError("ORDER_NOT_FOUND", { orderId: "order-1" }, 404)
    );

    const request = createRequest({});
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toEqual({ code: "ORDER_NOT_FOUND", params: { orderId: "order-1" } });
  });

  it("should return 422 for ORDER_NOT_ELIGIBLE_FOR_MARK_PAID AppError", async () => {
    mockMerchantService.getMerchantById.mockResolvedValue(mockMerchant as never);
    mockOrderService.markCashOrderPaid.mockRejectedValue(
      new AppError("ORDER_NOT_ELIGIBLE_FOR_MARK_PAID", { orderId: "order-1" }, 422)
    );

    const request = createRequest({});
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.success).toBe(false);
    expect(data.error).toEqual({ code: "ORDER_NOT_ELIGIBLE_FOR_MARK_PAID", params: { orderId: "order-1" } });
  });

  it("should return 500 for unexpected errors", async () => {
    mockMerchantService.getMerchantById.mockResolvedValue(mockMerchant as never);
    mockOrderService.markCashOrderPaid.mockRejectedValue(new Error("Unexpected"));

    const request = createRequest({});
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toEqual({ code: "INTERNAL_ERROR" });
  });
});
