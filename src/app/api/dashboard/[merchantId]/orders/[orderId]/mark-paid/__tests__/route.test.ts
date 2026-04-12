import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCodes } from "@/lib/errors/error-codes";

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

  function createRequest(body: Record<string, unknown> = {}) {
    return new NextRequest(
      "http://localhost:3000/api/dashboard/merchant-1/orders/order-1/mark-paid",
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );
  }

  describe("Authorization", () => {
    it("should return 404 if merchant not found", async () => {
      mockMerchantService.getMerchantById.mockResolvedValue(null);

      const request = createRequest();
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Merchant not found");
    });
  });

  describe("Validation", () => {
    beforeEach(() => {
      mockMerchantService.getMerchantById.mockResolvedValue(
        mockMerchant as never
      );
    });

    it("should return 400 if amount is negative", async () => {
      const request = createRequest({ amount: -10 });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("should return 400 if amount is zero", async () => {
      const request = createRequest({ amount: 0 });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("should return 400 if notes exceeds max length", async () => {
      const request = createRequest({ notes: "a".repeat(501) });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("should accept valid optional amount", async () => {
      mockOrderService.markCashOrderPaid.mockResolvedValue(undefined);

      const request = createRequest({ amount: 25.5 });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockOrderService.markCashOrderPaid).toHaveBeenCalledWith(
        "tenant-1",
        "order-1",
        { amount: 25.5 }
      );
    });

    it("should accept empty body", async () => {
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
  });

  describe("Success Cases", () => {
    beforeEach(() => {
      mockMerchantService.getMerchantById.mockResolvedValue(
        mockMerchant as never
      );
    });

    it("should successfully mark order as paid", async () => {
      mockOrderService.markCashOrderPaid.mockResolvedValue(undefined);

      const request = createRequest();
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
      mockOrderService.markCashOrderPaid.mockResolvedValue(undefined);

      const request = createRequest({ amount: 42.0, notes: "Cash received" });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockOrderService.markCashOrderPaid).toHaveBeenCalledWith(
        "tenant-1",
        "order-1",
        { amount: 42.0, notes: "Cash received" }
      );
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      mockMerchantService.getMerchantById.mockResolvedValue(
        mockMerchant as never
      );
    });

    it("should return AppError status code when order not found", async () => {
      mockOrderService.markCashOrderPaid.mockRejectedValue(
        new AppError(ErrorCodes.ORDER_NOT_FOUND, { orderId: "order-1" })
      );

      const request = createRequest();
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("ORDER_NOT_FOUND");
    });

    it("should return AppError when order not eligible", async () => {
      mockOrderService.markCashOrderPaid.mockRejectedValue(
        new AppError(ErrorCodes.ORDER_NOT_ELIGIBLE_FOR_MARK_PAID, {
          orderId: "order-1",
        })
      );

      const request = createRequest();
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("ORDER_NOT_ELIGIBLE_FOR_MARK_PAID");
    });

    it("should return 500 for unexpected errors", async () => {
      mockOrderService.markCashOrderPaid.mockRejectedValue(
        new Error("Database connection failed")
      );

      const request = createRequest();
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Failed to mark order as paid");
    });
  });
});
