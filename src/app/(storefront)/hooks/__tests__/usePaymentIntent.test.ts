import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { usePaymentIntent } from "../usePaymentIntent";

describe("usePaymentIntent", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should not create payment intent when amount is null", () => {
    renderHook(() =>
      usePaymentIntent({
        amount: null,
        apiPath: "/api/payment-intent",
      })
    );

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should not create payment intent when amount is 0", () => {
    renderHook(() =>
      usePaymentIntent({
        amount: 0,
        apiPath: "/api/payment-intent",
      })
    );

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should not create payment intent when autoCreate is false", () => {
    renderHook(() =>
      usePaymentIntent({
        amount: 100,
        apiPath: "/api/payment-intent",
        autoCreate: false,
      })
    );

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should create payment intent when amount > 0", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            clientSecret: "pi_test_secret",
            paymentIntentId: "pi_test_id",
          },
        }),
    });

    const { result } = renderHook(() =>
      usePaymentIntent({
        amount: 100,
        apiPath: "/api/payment-intent",
      })
    );

    await waitFor(() => {
      expect(result.current.clientSecret).toBe("pi_test_secret");
    });

    expect(result.current.paymentIntentId).toBe("pi_test_id");
    expect(result.current.isCreatingPaymentIntent).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should send correct request body", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            clientSecret: "pi_test_secret",
            paymentIntentId: "pi_test_id",
          },
        }),
    });

    renderHook(() =>
      usePaymentIntent({
        amount: 99.99,
        apiPath: "/api/storefront/test/payment-intent",
        loyaltyMemberId: "member_123",
      })
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/storefront/test/payment-intent",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: 99.99,
            currency: "USD",
            loyaltyMemberId: "member_123",
          }),
        })
      );
    });
  });

  it("should handle API error response", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          success: false,
          error: "Payment initialization failed",
        }),
    });

    const { result } = renderHook(() =>
      usePaymentIntent({
        amount: 100,
        apiPath: "/api/payment-intent",
      })
    );

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.clientSecret).toBeNull();
    expect(result.current.paymentIntentId).toBeNull();
  });

  it("should use default error message when API error is empty", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          success: false,
        }),
    });

    const { result } = renderHook(() =>
      usePaymentIntent({
        amount: 100,
        apiPath: "/api/payment-intent",
      })
    );

    await waitFor(() => {
      expect(result.current.error).toBe("Failed to initialize payment");
    });
  });

  it("should handle network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() =>
      usePaymentIntent({
        amount: 100,
        apiPath: "/api/payment-intent",
      })
    );

    await waitFor(() => {
      expect(result.current.error).toBe("Failed to initialize payment");
    });
  });

  it("should reset state when reset is called", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            clientSecret: "pi_test_secret",
            paymentIntentId: "pi_test_id",
          },
        }),
    });

    const { result } = renderHook(() =>
      usePaymentIntent({
        amount: 100,
        apiPath: "/api/payment-intent",
      })
    );

    await waitFor(() => {
      expect(result.current.clientSecret).toBe("pi_test_secret");
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.clientSecret).toBeNull();
    expect(result.current.paymentIntentId).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("should set isCreatingPaymentIntent to true while fetching", async () => {
    let resolvePromise: (value: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockFetch.mockReturnValueOnce(pendingPromise);

    const { result } = renderHook(() =>
      usePaymentIntent({
        amount: 100,
        apiPath: "/api/payment-intent",
      })
    );

    await waitFor(() => {
      expect(result.current.isCreatingPaymentIntent).toBe(true);
    });

    // Resolve the promise
    act(() => {
      resolvePromise!({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              clientSecret: "pi_test_secret",
              paymentIntentId: "pi_test_id",
            },
          }),
      });
    });

    await waitFor(() => {
      expect(result.current.isCreatingPaymentIntent).toBe(false);
    });
  });
});
