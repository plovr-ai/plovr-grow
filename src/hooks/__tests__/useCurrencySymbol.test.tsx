import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCurrencySymbol } from "../useCurrencySymbol";
import { MerchantProvider } from "@/contexts";
import type { ReactNode } from "react";

function createWrapper(currency: string, locale: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MerchantProvider config={{ name: "Test", logoUrl: null, currency, locale, timezone: "America/New_York" }}>
        {children}
      </MerchantProvider>
    );
  };
}

describe("useCurrencySymbol", () => {
  it("should return $ for USD", () => {
    const { result } = renderHook(() => useCurrencySymbol(), {
      wrapper: createWrapper("USD", "en-US"),
    });
    expect(result.current).toBe("$");
  });

  it("should return correct symbol for EUR", () => {
    const { result } = renderHook(() => useCurrencySymbol(), {
      wrapper: createWrapper("EUR", "de-DE"),
    });
    expect(result.current).toContain("€");
  });
});
