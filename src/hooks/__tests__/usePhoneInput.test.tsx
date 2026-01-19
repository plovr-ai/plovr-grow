import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { MerchantProvider } from "@/contexts";
import { usePhoneInput } from "../usePhoneInput";
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

describe("usePhoneInput", () => {
  describe("format function", () => {
    describe("with en-US locale", () => {
      const wrapper = createWrapper("en-US");

      it("should format progressive input", () => {
        const { result } = renderHook(() => usePhoneInput(), { wrapper });
        expect(result.current.format("2")).toBe("(2");
        expect(result.current.format("212")).toBe("(212");
        expect(result.current.format("2125")).toBe("(212) 5");
        expect(result.current.format("212555")).toBe("(212) 555");
        expect(result.current.format("2125550100")).toBe("(212) 555-0100");
      });

      it("should handle formatted input (idempotent)", () => {
        const { result } = renderHook(() => usePhoneInput(), { wrapper });
        expect(result.current.format("(212) 555-0100")).toBe("(212) 555-0100");
      });

      it("should limit to 10 digits", () => {
        const { result } = renderHook(() => usePhoneInput(), { wrapper });
        expect(result.current.format("21255501001234")).toBe("(212) 555-0100");
      });

      it("should handle empty string", () => {
        const { result } = renderHook(() => usePhoneInput(), { wrapper });
        expect(result.current.format("")).toBe("");
      });
    });

    describe("with non-US locale", () => {
      const wrapper = createWrapper("de-DE");

      it("should return original value", () => {
        const { result } = renderHook(() => usePhoneInput(), { wrapper });
        expect(result.current.format("12345")).toBe("12345");
        expect(result.current.format("+49 30 12345678")).toBe("+49 30 12345678");
      });
    });
  });

  describe("getRawValue function", () => {
    const wrapper = createWrapper("en-US");

    it("should extract digits from formatted phone", () => {
      const { result } = renderHook(() => usePhoneInput(), { wrapper });
      expect(result.current.getRawValue("(212) 555-0100")).toBe("2125550100");
    });

    it("should handle partial formatted phone", () => {
      const { result } = renderHook(() => usePhoneInput(), { wrapper });
      expect(result.current.getRawValue("(212) 5")).toBe("2125");
    });

    it("should handle empty string", () => {
      const { result } = renderHook(() => usePhoneInput(), { wrapper });
      expect(result.current.getRawValue("")).toBe("");
    });

    it("should handle already raw digits", () => {
      const { result } = renderHook(() => usePhoneInput(), { wrapper });
      expect(result.current.getRawValue("2125550100")).toBe("2125550100");
    });
  });

  describe("memoization", () => {
    it("should return the same format function reference when locale unchanged", () => {
      const wrapper = createWrapper("en-US");
      const { result, rerender } = renderHook(() => usePhoneInput(), {
        wrapper,
      });

      const firstFormat = result.current.format;
      const firstGetRaw = result.current.getRawValue;
      rerender();

      expect(result.current.format).toBe(firstFormat);
      expect(result.current.getRawValue).toBe(firstGetRaw);
    });
  });

  it("should throw error when used outside MerchantProvider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => usePhoneInput());
    }).toThrow("useMerchantConfig must be used within MerchantProvider");

    consoleSpy.mockRestore();
  });
});
