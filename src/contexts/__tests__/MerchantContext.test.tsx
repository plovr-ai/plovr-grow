import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  MerchantProvider,
  useMerchantConfig,
  useTipConfig,
  useFeeConfig,
  useCompanySlug,
  useCompanyId,
  useTimezone,
  useCountry,
} from "../MerchantContext";
import { DEFAULT_TIP_CONFIG, DEFAULT_FEE_CONFIG } from "@/types";
import type { ReactNode } from "react";

describe("MerchantContext", () => {
  describe("MerchantProvider", () => {
    it("should provide config to children", () => {
      const config = { name: "Test", logoUrl: null, currency: "USD", locale: "en-US", timezone: "America/New_York" };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useMerchantConfig(), { wrapper });

      expect(result.current.currency).toBe("USD");
      expect(result.current.locale).toBe("en-US");
    });

    it("should provide EUR config correctly", () => {
      const config = { name: "Test", logoUrl: null, currency: "EUR", locale: "de-DE", timezone: "Europe/Berlin" };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useMerchantConfig(), { wrapper });

      expect(result.current.currency).toBe("EUR");
      expect(result.current.locale).toBe("de-DE");
    });

    it("should provide CNY config correctly", () => {
      const config = { name: "Test", logoUrl: null, currency: "CNY", locale: "zh-CN", timezone: "Asia/Shanghai" };

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
      const config = { name: "Test", logoUrl: null, currency: "USD", locale: "en-US", timezone: "America/New_York" };

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
      const outerConfig = { name: "Test", logoUrl: null, currency: "USD", locale: "en-US", timezone: "America/New_York" };
      const innerConfig = { name: "Test", logoUrl: null, currency: "EUR", locale: "de-DE", timezone: "Europe/Berlin" };

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

  describe("tipConfig", () => {
    it("should use default tipConfig when not provided", () => {
      const config = { name: "Test", logoUrl: null, currency: "USD", locale: "en-US", timezone: "America/New_York" };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useTipConfig(), { wrapper });

      expect(result.current).toEqual(DEFAULT_TIP_CONFIG);
      expect(result.current.mode).toBe("percentage");
      expect(result.current.tiers).toEqual([0.15, 0.18, 0.2]);
      expect(result.current.allowCustom).toBe(true);
    });

    it("should use provided tipConfig when available", () => {
      const customTipConfig = {
        mode: "fixed" as const,
        tiers: [1, 2, 3],
        allowCustom: false,
      };
      const config = {
        name: "Test",
        logoUrl: null,
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
        tipConfig: customTipConfig,
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useTipConfig(), { wrapper });

      expect(result.current).toEqual(customTipConfig);
      expect(result.current.mode).toBe("fixed");
      expect(result.current.tiers).toEqual([1, 2, 3]);
      expect(result.current.allowCustom).toBe(false);
    });

    it("should use default tipConfig when undefined is passed", () => {
      const config = {
        name: "Test",
        logoUrl: null,
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
        tipConfig: undefined,
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useTipConfig(), { wrapper });

      expect(result.current).toEqual(DEFAULT_TIP_CONFIG);
    });
  });

  describe("feeConfig", () => {
    it("should use default feeConfig (empty fees) when not provided", () => {
      const config = { name: "Test", logoUrl: null, currency: "USD", locale: "en-US", timezone: "America/New_York" };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useFeeConfig(), { wrapper });

      expect(result.current).toEqual(DEFAULT_FEE_CONFIG);
      expect(result.current.fees).toEqual([]);
    });

    it("should use provided feeConfig when available", () => {
      const customFeeConfig = {
        fees: [
          {
            id: "service-fee",
            name: "service_fee",
            displayName: "Service Fee",
            type: "percentage" as const,
            value: 0.03,
          },
        ],
      };
      const config = {
        name: "Test",
        logoUrl: null,
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
        feeConfig: customFeeConfig,
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useFeeConfig(), { wrapper });

      expect(result.current).toEqual(customFeeConfig);
      expect(result.current.fees).toHaveLength(1);
      expect(result.current.fees[0].id).toBe("service-fee");
      expect(result.current.fees[0].value).toBe(0.03);
    });

    it("should use default feeConfig when undefined is passed", () => {
      const config = {
        name: "Test",
        logoUrl: null,
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
        feeConfig: undefined,
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useFeeConfig(), { wrapper });

      expect(result.current).toEqual(DEFAULT_FEE_CONFIG);
      expect(result.current.fees).toEqual([]);
    });

    it("should handle multiple fees", () => {
      const customFeeConfig = {
        fees: [
          {
            id: "service-fee",
            name: "service_fee",
            displayName: "Service Fee",
            type: "percentage" as const,
            value: 0.03,
          },
          {
            id: "delivery-fee",
            name: "delivery_fee",
            displayName: "Delivery Fee",
            type: "fixed" as const,
            value: 5.0,
          },
        ],
      };
      const config = {
        name: "Test",
        logoUrl: null,
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
        feeConfig: customFeeConfig,
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useFeeConfig(), { wrapper });

      expect(result.current.fees).toHaveLength(2);
      expect(result.current.fees[0].type).toBe("percentage");
      expect(result.current.fees[1].type).toBe("fixed");
    });
  });

  describe("config with both tipConfig and feeConfig", () => {
    it("should handle full config with all options", () => {
      const config = {
        name: "Test",
        logoUrl: null,
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
        tipConfig: {
          mode: "percentage" as const,
          tiers: [0.15, 0.18, 0.2],
          allowCustom: true,
        },
        feeConfig: {
          fees: [
            {
              id: "service-fee",
              name: "service_fee",
              displayName: "Service Fee",
              type: "percentage" as const,
              value: 0.03,
            },
          ],
        },
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useMerchantConfig(), { wrapper });

      expect(result.current.currency).toBe("USD");
      expect(result.current.locale).toBe("en-US");
      expect(result.current.tipConfig.mode).toBe("percentage");
      expect(result.current.feeConfig.fees).toHaveLength(1);
    });

    it("should handle partial config (only tipConfig)", () => {
      const config = {
        name: "Test",
        logoUrl: null,
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
        tipConfig: {
          mode: "fixed" as const,
          tiers: [1, 2, 3],
          allowCustom: false,
        },
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useMerchantConfig(), { wrapper });

      expect(result.current.tipConfig.mode).toBe("fixed");
      expect(result.current.feeConfig).toEqual(DEFAULT_FEE_CONFIG);
    });

    it("should handle partial config (only feeConfig)", () => {
      const config = {
        name: "Test",
        logoUrl: null,
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
        feeConfig: {
          fees: [
            {
              id: "test-fee",
              name: "test",
              type: "fixed" as const,
              value: 1.0,
            },
          ],
        },
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useMerchantConfig(), { wrapper });

      expect(result.current.tipConfig).toEqual(DEFAULT_TIP_CONFIG);
      expect(result.current.feeConfig.fees).toHaveLength(1);
    });
  });

  describe("companySlug", () => {
    it("should provide companySlug when set", () => {
      const config = {
        name: "Test",
        logoUrl: null,
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
        companySlug: "joes-pizza",
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useMerchantConfig(), { wrapper });

      expect(result.current.companySlug).toBe("joes-pizza");
    });

    it("should default companySlug to null when not provided", () => {
      const config = {
        name: "Test",
        logoUrl: null,
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useMerchantConfig(), { wrapper });

      expect(result.current.companySlug).toBeNull();
    });

    it("should default companySlug to null when explicitly set to undefined", () => {
      const config = {
        name: "Test",
        logoUrl: null,
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
        companySlug: undefined,
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useMerchantConfig(), { wrapper });

      expect(result.current.companySlug).toBeNull();
    });
  });

  describe("useCompanySlug", () => {
    it("should return companySlug value", () => {
      const config = {
        name: "Test",
        logoUrl: null,
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
        companySlug: "bellas-bakery",
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useCompanySlug(), { wrapper });

      expect(result.current).toBe("bellas-bakery");
    });

    it("should return null when companySlug is not set", () => {
      const config = {
        name: "Test",
        logoUrl: null,
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useCompanySlug(), { wrapper });

      expect(result.current).toBeNull();
    });

    it("should throw error when used outside provider", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => {
        renderHook(() => useCompanySlug());
      }).toThrow("useMerchantConfig must be used within MerchantProvider");

      consoleSpy.mockRestore();
    });
  });

  describe("companyId", () => {
    it("should provide companyId when set", () => {
      const config = {
        name: "Test",
        logoUrl: null,
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
        companyId: "comp-123-abc",
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useMerchantConfig(), { wrapper });

      expect(result.current.companyId).toBe("comp-123-abc");
    });

    it("should default companyId to null when not provided", () => {
      const config = {
        name: "Test",
        logoUrl: null,
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useMerchantConfig(), { wrapper });

      expect(result.current.companyId).toBeNull();
    });

    it("should default companyId to null when explicitly set to undefined", () => {
      const config = {
        name: "Test",
        logoUrl: null,
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
        companyId: undefined,
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useMerchantConfig(), { wrapper });

      expect(result.current.companyId).toBeNull();
    });
  });

  describe("useCompanyId", () => {
    it("should return companyId value", () => {
      const config = {
        name: "Test",
        logoUrl: null,
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
        companyId: "comp-456-def",
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useCompanyId(), { wrapper });

      expect(result.current).toBe("comp-456-def");
    });

    it("should return null when companyId is not set", () => {
      const config = {
        name: "Test",
        logoUrl: null,
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useCompanyId(), { wrapper });

      expect(result.current).toBeNull();
    });

    it("should throw error when used outside provider", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => {
        renderHook(() => useCompanyId());
      }).toThrow("useMerchantConfig must be used within MerchantProvider");

      consoleSpy.mockRestore();
    });
  });

  describe("companySlug and companyId together", () => {
    it("should provide both companySlug and companyId when set", () => {
      const config = {
        name: "Test",
        logoUrl: null,
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
        companySlug: "joes-pizza",
        companyId: "comp-789-xyz",
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result: configResult } = renderHook(() => useMerchantConfig(), { wrapper });
      const { result: slugResult } = renderHook(() => useCompanySlug(), { wrapper });
      const { result: idResult } = renderHook(() => useCompanyId(), { wrapper });

      expect(configResult.current.companySlug).toBe("joes-pizza");
      expect(configResult.current.companyId).toBe("comp-789-xyz");
      expect(slugResult.current).toBe("joes-pizza");
      expect(idResult.current).toBe("comp-789-xyz");
    });
  });

  describe("useTimezone", () => {
    it("should return timezone value", () => {
      const config = {
        name: "Test",
        logoUrl: null,
        currency: "USD",
        locale: "en-US",
        timezone: "America/Los_Angeles",
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useTimezone(), { wrapper });

      expect(result.current).toBe("America/Los_Angeles");
    });

    it("should throw error when used outside provider", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => {
        renderHook(() => useTimezone());
      }).toThrow("useMerchantConfig must be used within MerchantProvider");

      consoleSpy.mockRestore();
    });
  });

  describe("country", () => {
    it("should provide country when set", () => {
      const config = {
        name: "Test",
        logoUrl: null,
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
        country: "CA",
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useMerchantConfig(), { wrapper });

      expect(result.current.country).toBe("CA");
    });

    it("should default country to US when not provided", () => {
      const config = {
        name: "Test",
        logoUrl: null,
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useMerchantConfig(), { wrapper });

      expect(result.current.country).toBe("US");
    });

    it("should default country to US when explicitly set to undefined", () => {
      const config = {
        name: "Test",
        logoUrl: null,
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
        country: undefined,
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useMerchantConfig(), { wrapper });

      expect(result.current.country).toBe("US");
    });
  });

  describe("useCountry", () => {
    it("should return country value", () => {
      const config = {
        name: "Test",
        logoUrl: null,
        currency: "EUR",
        locale: "de-DE",
        timezone: "Europe/Berlin",
        country: "DE",
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useCountry(), { wrapper });

      expect(result.current).toBe("DE");
    });

    it("should return US when country is not set", () => {
      const config = {
        name: "Test",
        logoUrl: null,
        currency: "USD",
        locale: "en-US",
        timezone: "America/New_York",
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <MerchantProvider config={config}>{children}</MerchantProvider>
      );

      const { result } = renderHook(() => useCountry(), { wrapper });

      expect(result.current).toBe("US");
    });

    it("should throw error when used outside provider", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => {
        renderHook(() => useCountry());
      }).toThrow("useMerchantConfig must be used within MerchantProvider");

      consoleSpy.mockRestore();
    });
  });
});
