import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDashboardFormatDateTime } from "../useDashboardFormatDateTime";
import { DashboardProvider } from "@/contexts/DashboardContext";
import type { DashboardContextValue } from "@/contexts/DashboardContext";
import type { ReactNode } from "react";

const mockDashboardValue: DashboardContextValue = {
  tenantId: "tenant-1",
  tenant: {
    id: "tenant-1",
    name: "Test Company",
    slug: "test-company",
    logoUrl: null,
  },
  merchants: [],
  currency: "USD",
  locale: "en-US",
  subscription: null,
  onboarding: {
    status: "not_started",
    data: null,
  },
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <DashboardProvider value={mockDashboardValue}>{children}</DashboardProvider>
);

describe("useDashboardFormatDateTime", () => {
  it("should format date using provided timezone", () => {
    const { result } = renderHook(
      () => useDashboardFormatDateTime("America/New_York"),
      { wrapper }
    );

    const date = new Date("2024-01-15T20:30:00Z");
    const formatted = result.current.formatDate(date);
    expect(formatted).toBe("Jan 15, 2024");
  });

  it("should format time using provided timezone", () => {
    const { result } = renderHook(
      () => useDashboardFormatDateTime("America/New_York"),
      { wrapper }
    );

    const date = new Date("2024-01-15T20:30:00Z");
    const formatted = result.current.formatTime(date);
    expect(formatted).toContain("3:30");
  });

  it("should use default timezone when none provided", () => {
    const { result } = renderHook(
      () => useDashboardFormatDateTime(),
      { wrapper }
    );

    expect(result.current.timezone).toBe("America/New_York");
  });

  it("should return timezone abbreviation", () => {
    const { result } = renderHook(
      () => useDashboardFormatDateTime("America/New_York"),
      { wrapper }
    );

    // EST or EDT depending on date
    expect(result.current.timezoneAbbr).toBeTruthy();
  });

  it("should provide formatDateTime function", () => {
    const { result } = renderHook(
      () => useDashboardFormatDateTime("America/New_York"),
      { wrapper }
    );

    const date = new Date("2024-01-15T20:30:00Z");
    const formatted = result.current.formatDateTime(date);
    expect(formatted).toBeTruthy();
  });
});
