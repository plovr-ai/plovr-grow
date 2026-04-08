import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFormatDateTime } from "../useFormatDateTime";
import { MerchantProvider } from "@/contexts";
import type { ReactNode } from "react";

describe("useFormatDateTime", () => {
  const createWrapper = (timezone: string, locale: string) => {
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <MerchantProvider
        config={{
          name: "Test Store",
          logoUrl: null,
          currency: "USD",
          locale,
          timezone,
        }}
      >
        {children}
      </MerchantProvider>
    );
    Wrapper.displayName = "TestMerchantWrapper";
    return Wrapper;
  };

  describe("formatDate", () => {
    it("should format date using merchant timezone", () => {
      const wrapper = createWrapper("America/New_York", "en-US");
      const { result } = renderHook(() => useFormatDateTime(), { wrapper });

      // 2024-01-15T20:30:00Z = 3:30 PM EST on Jan 15
      const date = new Date("2024-01-15T20:30:00Z");
      expect(result.current.formatDate(date)).toBe("Jan 15, 2024");
    });

    it("should respect different timezones", () => {
      // Test with Tokyo timezone
      const wrapper = createWrapper("Asia/Tokyo", "en-US");
      const { result } = renderHook(() => useFormatDateTime(), { wrapper });

      // 2024-01-15T23:30:00Z = 8:30 AM on Jan 16 in Tokyo
      const date = new Date("2024-01-15T23:30:00Z");
      expect(result.current.formatDate(date)).toBe("Jan 16, 2024");
    });

    it("should handle date string input", () => {
      const wrapper = createWrapper("America/New_York", "en-US");
      const { result } = renderHook(() => useFormatDateTime(), { wrapper });

      expect(result.current.formatDate("2024-01-15T20:30:00Z")).toBe(
        "Jan 15, 2024"
      );
    });
  });

  describe("formatTime", () => {
    it("should format time using merchant timezone", () => {
      const wrapper = createWrapper("America/New_York", "en-US");
      const { result } = renderHook(() => useFormatDateTime(), { wrapper });

      // 2024-01-15T20:30:00Z = 3:30 PM EST
      const date = new Date("2024-01-15T20:30:00Z");
      expect(result.current.formatTime(date)).toBe("3:30 PM");
    });

    it("should respect different timezones", () => {
      const wrapper = createWrapper("America/Los_Angeles", "en-US");
      const { result } = renderHook(() => useFormatDateTime(), { wrapper });

      // 2024-01-15T20:30:00Z = 12:30 PM PST
      const date = new Date("2024-01-15T20:30:00Z");
      expect(result.current.formatTime(date)).toBe("12:30 PM");
    });
  });

  describe("formatDateTime", () => {
    it("should format full date and time", () => {
      const wrapper = createWrapper("America/New_York", "en-US");
      const { result } = renderHook(() => useFormatDateTime(), { wrapper });

      const date = new Date("2024-01-15T20:30:00Z");
      const formatted = result.current.formatDateTime(date);

      expect(formatted).toContain("Jan 15, 2024");
      expect(formatted).toContain("3:30 PM");
    });

    it("should accept custom options", () => {
      const wrapper = createWrapper("America/New_York", "en-US");
      const { result } = renderHook(() => useFormatDateTime(), { wrapper });

      const date = new Date("2024-01-15T20:30:00Z");
      const formatted = result.current.formatDateTime(date, {
        weekday: "long",
      });

      expect(formatted).toContain("Monday");
    });
  });

  describe("timezone and timezoneAbbr", () => {
    it("should expose the timezone value", () => {
      const wrapper = createWrapper("America/New_York", "en-US");
      const { result } = renderHook(() => useFormatDateTime(), { wrapper });

      expect(result.current.timezone).toBe("America/New_York");
    });

    it("should return timezone abbreviation", () => {
      const wrapper = createWrapper("America/New_York", "en-US");
      const { result } = renderHook(() => useFormatDateTime(), { wrapper });

      // Should return EST or EDT depending on DST
      expect(["EST", "EDT"]).toContain(result.current.timezoneAbbr);
    });

    it("should return PST/PDT for Los Angeles", () => {
      const wrapper = createWrapper("America/Los_Angeles", "en-US");
      const { result } = renderHook(() => useFormatDateTime(), { wrapper });

      expect(["PST", "PDT"]).toContain(result.current.timezoneAbbr);
    });
  });

  describe("different locales", () => {
    it("should format date in German locale", () => {
      const wrapper = createWrapper("Europe/Berlin", "de-DE");
      const { result } = renderHook(() => useFormatDateTime(), { wrapper });

      const date = new Date("2024-01-15T12:00:00Z");
      const formatted = result.current.formatDate(date);

      // German date format typically has day before month
      expect(formatted).toMatch(/15.*2024/);
    });
  });

  describe("error handling", () => {
    it("should throw error when used outside MerchantProvider", () => {
      expect(() => {
        renderHook(() => useFormatDateTime());
      }).toThrow("useMerchantConfig must be used within MerchantProvider");
    });
  });
});
