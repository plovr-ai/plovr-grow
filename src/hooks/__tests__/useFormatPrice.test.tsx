import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { MerchantProvider } from "@/contexts";
import { useFormatPrice } from "../useFormatPrice";
import type { ReactNode } from "react";

function createWrapper(currency: string, locale: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MerchantProvider config={{ currency, locale }}>
        {children}
      </MerchantProvider>
    );
  };
}

describe("useFormatPrice", () => {
  describe("with USD/en-US config", () => {
    const wrapper = createWrapper("USD", "en-US");

    it("should format price in USD", () => {
      const { result } = renderHook(() => useFormatPrice(), { wrapper });
      expect(result.current(100)).toBe("$100.00");
    });

    it("should format decimal prices", () => {
      const { result } = renderHook(() => useFormatPrice(), { wrapper });
      expect(result.current(18.99)).toBe("$18.99");
    });

    it("should handle string input", () => {
      const { result } = renderHook(() => useFormatPrice(), { wrapper });
      expect(result.current("25.50")).toBe("$25.50");
    });
  });

  describe("with EUR/de-DE config", () => {
    const wrapper = createWrapper("EUR", "de-DE");

    it("should format price in EUR with German locale", () => {
      const { result } = renderHook(() => useFormatPrice(), { wrapper });
      const formatted = result.current(100);
      expect(formatted).toContain("100,00");
      expect(formatted).toContain("€");
    });

    it("should format decimal prices in EUR", () => {
      const { result } = renderHook(() => useFormatPrice(), { wrapper });
      const formatted = result.current(18.99);
      expect(formatted).toContain("18,99");
      expect(formatted).toContain("€");
    });
  });

  describe("with CNY/zh-CN config", () => {
    const wrapper = createWrapper("CNY", "zh-CN");

    it("should format price in CNY", () => {
      const { result } = renderHook(() => useFormatPrice(), { wrapper });
      const formatted = result.current(100);
      expect(formatted).toContain("¥");
      expect(formatted).toContain("100.00");
    });
  });

  describe("with JPY/ja-JP config", () => {
    const wrapper = createWrapper("JPY", "ja-JP");

    it("should format price in JPY without decimals", () => {
      const { result } = renderHook(() => useFormatPrice(), { wrapper });
      const formatted = result.current(100);
      expect(formatted).toContain("￥");
      expect(formatted).toContain("100");
      // JPY should not have decimal places
      expect(formatted).not.toContain(".");
    });
  });

  describe("with GBP/en-GB config", () => {
    const wrapper = createWrapper("GBP", "en-GB");

    it("should format price in GBP", () => {
      const { result } = renderHook(() => useFormatPrice(), { wrapper });
      expect(result.current(100)).toBe("£100.00");
    });
  });

  describe("memoization", () => {
    it("should return the same function reference when config unchanged", () => {
      const wrapper = createWrapper("USD", "en-US");
      const { result, rerender } = renderHook(() => useFormatPrice(), {
        wrapper,
      });

      const firstRender = result.current;
      rerender();
      const secondRender = result.current;

      expect(firstRender).toBe(secondRender);
    });
  });

  it("should throw error when used outside MerchantProvider", () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useFormatPrice());
    }).toThrow("useMerchantConfig must be used within MerchantProvider");

    consoleSpy.mockRestore();
  });
});
