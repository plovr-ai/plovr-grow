import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { type ReactNode } from "react";
import { DashboardProvider } from "@/contexts";
import { useDashboardFormatPrice, useDashboardCurrencySymbol } from "../useDashboardFormatPrice";

// Helper to create a wrapper with DashboardContext
function createWrapper(currency: string, locale: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <DashboardProvider
        value={{
          tenantId: "tenant-1",
          tenant: {
            id: "company-1",
            name: "Test Company",
            slug: "test-company",
            logoUrl: null,
          },
          merchants: [],
          currency,
          locale,
          subscription: null,
        onboarding: { status: "not_started" as const, data: null },
        }}
      >
        {children}
      </DashboardProvider>
    );
  };
}

describe("useDashboardFormatPrice", () => {
  describe("USD formatting", () => {
    it("should format price in USD with en-US locale", () => {
      const wrapper = createWrapper("USD", "en-US");
      const { result } = renderHook(() => useDashboardFormatPrice(), { wrapper });

      expect(result.current(10)).toBe("$10.00");
      expect(result.current(18.99)).toBe("$18.99");
      expect(result.current(1000)).toBe("$1,000.00");
    });

    it("should handle string input", () => {
      const wrapper = createWrapper("USD", "en-US");
      const { result } = renderHook(() => useDashboardFormatPrice(), { wrapper });

      expect(result.current("18.99")).toBe("$18.99");
    });

    it("should handle zero", () => {
      const wrapper = createWrapper("USD", "en-US");
      const { result } = renderHook(() => useDashboardFormatPrice(), { wrapper });

      expect(result.current(0)).toBe("$0.00");
    });
  });

  describe("EUR formatting", () => {
    it("should format price in EUR with de-DE locale", () => {
      const wrapper = createWrapper("EUR", "de-DE");
      const { result } = renderHook(() => useDashboardFormatPrice(), { wrapper });

      // German locale uses comma as decimal separator and period as thousands separator
      const formatted = result.current(1000.5);
      expect(formatted).toContain("€");
      expect(formatted).toContain("1.000");
    });

    it("should format price in EUR with en-US locale", () => {
      const wrapper = createWrapper("EUR", "en-US");
      const { result } = renderHook(() => useDashboardFormatPrice(), { wrapper });

      expect(result.current(18.99)).toBe("€18.99");
    });
  });

  describe("CNY formatting", () => {
    it("should format price in CNY with zh-CN locale", () => {
      const wrapper = createWrapper("CNY", "zh-CN");
      const { result } = renderHook(() => useDashboardFormatPrice(), { wrapper });

      const formatted = result.current(100);
      expect(formatted).toContain("¥");
      expect(formatted).toContain("100");
    });
  });

  describe("JPY formatting", () => {
    it("should format price in JPY without decimal places", () => {
      const wrapper = createWrapper("JPY", "ja-JP");
      const { result } = renderHook(() => useDashboardFormatPrice(), { wrapper });

      const formatted = result.current(1000);
      // JPY uses fullwidth yen sign (￥) in ja-JP locale
      expect(formatted).toMatch(/[¥￥]/);
      // JPY typically doesn't use decimal places
      expect(formatted).not.toContain(".");
    });
  });
});

describe("useDashboardCurrencySymbol", () => {
  it("should return $ for USD", () => {
    const wrapper = createWrapper("USD", "en-US");
    const { result } = renderHook(() => useDashboardCurrencySymbol(), { wrapper });

    expect(result.current).toBe("$");
  });

  it("should return € for EUR", () => {
    const wrapper = createWrapper("EUR", "en-US");
    const { result } = renderHook(() => useDashboardCurrencySymbol(), { wrapper });

    expect(result.current).toBe("€");
  });

  it("should return ¥ for CNY", () => {
    const wrapper = createWrapper("CNY", "zh-CN");
    const { result } = renderHook(() => useDashboardCurrencySymbol(), { wrapper });

    expect(result.current).toBe("¥");
  });

  it("should return £ for GBP", () => {
    const wrapper = createWrapper("GBP", "en-GB");
    const { result } = renderHook(() => useDashboardCurrencySymbol(), { wrapper });

    expect(result.current).toBe("£");
  });
});
