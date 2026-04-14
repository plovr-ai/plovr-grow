import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  DashboardProvider,
  useDashboard,
  useMerchants,
  useDashboardCurrency,
  useDashboardLocale,
} from "../DashboardContext";
import type { DashboardContextValue } from "../DashboardContext";
import type { ReactNode } from "react";

const mockValue: DashboardContextValue = {
  tenantId: "tenant-1",
  tenant: {
    id: "tenant-1",
    name: "Test Company",
    slug: "test-company",
    logoUrl: "https://example.com/logo.png",
  },
  merchants: [
    {
      id: "merchant-1",
      name: "Main Store",
      slug: "main-store",
      address: "123 Main St",
      city: "San Francisco",
      status: "active",
    },
  ],
  currency: "USD",
  locale: "en-US",
  subscription: null,
  onboarding: {
    status: "not_started",
    data: null,
  },
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <DashboardProvider value={mockValue}>{children}</DashboardProvider>
);

describe("DashboardContext", () => {
  it("useDashboard should return full context value", () => {
    const { result } = renderHook(() => useDashboard(), { wrapper });

    expect(result.current.tenantId).toBe("tenant-1");
    expect(result.current.currency).toBe("USD");
    expect(result.current.locale).toBe("en-US");
  });

  it("useDashboard should throw when used outside provider", () => {
    expect(() => {
      renderHook(() => useDashboard());
    }).toThrow("useDashboard must be used within DashboardProvider");
  });

  it("useMerchants should return merchants list", () => {
    const { result } = renderHook(() => useMerchants(), { wrapper });

    expect(result.current).toHaveLength(1);
    expect(result.current[0].name).toBe("Main Store");
  });

  it("useDashboardCurrency should return currency string", () => {
    const { result } = renderHook(() => useDashboardCurrency(), { wrapper });
    expect(result.current).toBe("USD");
  });

  it("useDashboardLocale should return locale string", () => {
    const { result } = renderHook(() => useDashboardLocale(), { wrapper });
    expect(result.current).toBe("en-US");
  });
});
