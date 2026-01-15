import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { MerchantProvider, useMerchantConfig } from "../MerchantContext";
import type { ReactNode } from "react";

describe("MerchantContext", () => {
  describe("MerchantProvider", () => {
    it("should provide config to children", () => {
      const config = { currency: "USD", locale: "en-US" };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useMerchantConfig(), { wrapper });

      expect(result.current.currency).toBe("USD");
      expect(result.current.locale).toBe("en-US");
    });

    it("should provide EUR config correctly", () => {
      const config = { currency: "EUR", locale: "de-DE" };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useMerchantConfig(), { wrapper });

      expect(result.current.currency).toBe("EUR");
      expect(result.current.locale).toBe("de-DE");
    });

    it("should provide CNY config correctly", () => {
      const config = { currency: "CNY", locale: "zh-CN" };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useMerchantConfig(), { wrapper });

      expect(result.current.currency).toBe("CNY");
      expect(result.current.locale).toBe("zh-CN");
    });
  });

  describe("useMerchantConfig", () => {
    it("should throw error when used outside provider", () => {
      // Suppress console.error for this test
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => {
        renderHook(() => useMerchantConfig());
      }).toThrow("useMerchantConfig must be used within MerchantProvider");

      consoleSpy.mockRestore();
    });

    it("should return the same config object reference", () => {
      const config = { currency: "USD", locale: "en-US" };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result, rerender } = renderHook(() => useMerchantConfig(), {
        wrapper,
      });

      const firstRender = result.current;
      rerender();
      const secondRender = result.current;

      // Config should be the same reference since provider config didn't change
      expect(firstRender).toBe(secondRender);
    });
  });

  describe("nested providers", () => {
    it("should use the nearest provider config", () => {
      const outerConfig = { currency: "USD", locale: "en-US" };
      const innerConfig = { currency: "EUR", locale: "de-DE" };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={outerConfig}>
          <MerchantProvider config={innerConfig}>{children}</MerchantProvider>
        </MerchantProvider>
      );

      const { result } = renderHook(() => useMerchantConfig(), { wrapper });

      // Should use inner provider's config
      expect(result.current.currency).toBe("EUR");
      expect(result.current.locale).toBe("de-DE");
    });
  });
});
