import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { MerchantProvider } from "@/contexts";
import { useFormatPhone } from "../useFormatPhone";
import type { ReactNode } from "react";

function createWrapper(locale: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MerchantProvider config={{ currency: "USD", locale }}>
        {children}
      </MerchantProvider>
    );
  };
}

describe("useFormatPhone", () => {
  describe("with en-US locale", () => {
    const wrapper = createWrapper("en-US");

    it("should format 10-digit US phone number", () => {
      const { result } = renderHook(() => useFormatPhone(), { wrapper });
      expect(result.current("2125550100")).toBe("(212) 555-0100");
    });

    it("should format phone number with +1 country code", () => {
      const { result } = renderHook(() => useFormatPhone(), { wrapper });
      expect(result.current("+12125550100")).toBe("(212) 555-0100");
    });

    it("should format phone number with various separators", () => {
      const { result } = renderHook(() => useFormatPhone(), { wrapper });
      expect(result.current("212-555-0100")).toBe("(212) 555-0100");
      expect(result.current("212.555.0100")).toBe("(212) 555-0100");
      expect(result.current("212 555 0100")).toBe("(212) 555-0100");
    });
  });

  describe("with de-DE locale", () => {
    const wrapper = createWrapper("de-DE");

    it("should return original format for German numbers", () => {
      const { result } = renderHook(() => useFormatPhone(), { wrapper });
      expect(result.current("+49 30 12345678")).toBe("+49 30 12345678");
    });
  });

  describe("with zh-CN locale", () => {
    const wrapper = createWrapper("zh-CN");

    it("should return original format for Chinese numbers", () => {
      const { result } = renderHook(() => useFormatPhone(), { wrapper });
      expect(result.current("+86 10 12345678")).toBe("+86 10 12345678");
    });
  });

  describe("null and undefined handling", () => {
    const wrapper = createWrapper("en-US");

    it("should return empty string for null", () => {
      const { result } = renderHook(() => useFormatPhone(), { wrapper });
      expect(result.current(null)).toBe("");
    });

    it("should return empty string for undefined", () => {
      const { result } = renderHook(() => useFormatPhone(), { wrapper });
      expect(result.current(undefined)).toBe("");
    });

    it("should return empty string for empty string", () => {
      const { result } = renderHook(() => useFormatPhone(), { wrapper });
      expect(result.current("")).toBe("");
    });
  });

  describe("memoization", () => {
    it("should return the same function reference when locale unchanged", () => {
      const wrapper = createWrapper("en-US");
      const { result, rerender } = renderHook(() => useFormatPhone(), {
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
      renderHook(() => useFormatPhone());
    }).toThrow("useMerchantConfig must be used within MerchantProvider");

    consoleSpy.mockRestore();
  });
});
