import { describe, it, expect } from "vitest";
import {
  formatDate,
  formatTime,
  formatDateTime,
  getTimezoneAbbr,
  formatDateTimeWithTimezone,
} from "../datetime";

describe("datetime utilities", () => {
  // Use a fixed date for consistent testing
  const testDate = new Date("2024-01-15T20:30:00Z"); // 8:30 PM UTC

  describe("formatDate", () => {
    it("should format date in US locale", () => {
      const result = formatDate(testDate, "America/New_York", "en-US");
      // Jan 15, 2024 (3:30 PM EST is still Jan 15)
      expect(result).toBe("Jan 15, 2024");
    });

    it("should format date in German locale", () => {
      const result = formatDate(testDate, "Europe/Berlin", "de-DE");
      // In Berlin, 20:30 UTC = 21:30 CET = Jan 15
      expect(result).toMatch(/15.*2024/);
    });

    it("should handle date string input", () => {
      const result = formatDate(
        "2024-01-15T20:30:00Z",
        "America/New_York",
        "en-US"
      );
      expect(result).toBe("Jan 15, 2024");
    });

    it("should handle different timezone", () => {
      // Test a date that would be different day in different timezones
      const lateNightUTC = new Date("2024-01-15T23:30:00Z"); // 11:30 PM UTC

      // In New York (UTC-5), it's still Jan 15 at 6:30 PM
      const nyResult = formatDate(lateNightUTC, "America/New_York", "en-US");
      expect(nyResult).toBe("Jan 15, 2024");

      // In Tokyo (UTC+9), it's already Jan 16 at 8:30 AM
      const tokyoResult = formatDate(lateNightUTC, "Asia/Tokyo", "en-US");
      expect(tokyoResult).toBe("Jan 16, 2024");
    });
  });

  describe("formatTime", () => {
    it("should format time in 12-hour format", () => {
      const result = formatTime(testDate, "America/New_York", "en-US");
      // 20:30 UTC = 15:30 EST = 3:30 PM
      expect(result).toBe("3:30 PM");
    });

    it("should handle different timezones", () => {
      const result = formatTime(testDate, "America/Los_Angeles", "en-US");
      // 20:30 UTC = 12:30 PST
      expect(result).toBe("12:30 PM");
    });

    it("should handle date string input", () => {
      const result = formatTime(
        "2024-01-15T20:30:00Z",
        "America/New_York",
        "en-US"
      );
      expect(result).toBe("3:30 PM");
    });
  });

  describe("formatDateTime", () => {
    it("should format full date and time", () => {
      const result = formatDateTime(testDate, "America/New_York", "en-US");
      expect(result).toContain("Jan 15, 2024");
      expect(result).toContain("3:30 PM");
    });

    it("should accept custom options", () => {
      const result = formatDateTime(testDate, "America/New_York", "en-US", {
        weekday: "long",
      });
      expect(result).toContain("Monday");
    });

    it("should handle Date object input (non-string branch)", () => {
      const result = formatDateTime(testDate, "America/New_York", "en-US");
      expect(result).toContain("Jan 15, 2024");
    });

    it("should handle string input", () => {
      const result = formatDateTime("2024-01-15T20:30:00Z", "America/New_York", "en-US");
      expect(result).toContain("Jan 15, 2024");
    });
  });

  describe("getTimezoneAbbr", () => {
    it("should return timezone abbreviation for EST", () => {
      // January is standard time (EST, not EDT)
      const winterDate = new Date("2024-01-15T12:00:00Z");
      const result = getTimezoneAbbr("America/New_York", winterDate);
      expect(result).toBe("EST");
    });

    it("should return timezone abbreviation for EDT in summer", () => {
      // July is daylight saving time (EDT)
      const summerDate = new Date("2024-07-15T12:00:00Z");
      const result = getTimezoneAbbr("America/New_York", summerDate);
      expect(result).toBe("EDT");
    });

    it("should return timezone abbreviation for PST", () => {
      const winterDate = new Date("2024-01-15T12:00:00Z");
      const result = getTimezoneAbbr("America/Los_Angeles", winterDate);
      expect(result).toBe("PST");
    });

    it("should handle string date input in formatDate", () => {
      const result = formatDate("2024-07-15T12:00:00Z", "America/New_York", "en-US");
      expect(result).toBe("Jul 15, 2024");
    });

    it("should handle string date input in formatTime", () => {
      const result = formatTime("2024-01-15T20:30:00Z", "America/New_York", "en-US");
      expect(result).toBe("3:30 PM");
    });

    it("should use current date when no date provided", () => {
      const result = getTimezoneAbbr("America/New_York");
      // Should return either EST or EDT depending on current date
      expect(["EST", "EDT"]).toContain(result);
    });
  });

  describe("formatDateTimeWithTimezone", () => {
    it("should include timezone abbreviation in output", () => {
      const winterDate = new Date("2024-01-15T20:30:00Z");
      const result = formatDateTimeWithTimezone(
        winterDate,
        "America/New_York",
        "en-US"
      );
      expect(result).toBe("Jan 15, 2024 at 3:30 PM EST");
    });

    it("should work with different timezones", () => {
      const winterDate = new Date("2024-01-15T20:30:00Z");
      const result = formatDateTimeWithTimezone(
        winterDate,
        "America/Los_Angeles",
        "en-US"
      );
      expect(result).toBe("Jan 15, 2024 at 12:30 PM PST");
    });

    it("should handle string date input", () => {
      const result = formatDateTimeWithTimezone(
        "2024-01-15T20:30:00Z",
        "America/New_York",
        "en-US"
      );
      expect(result).toBe("Jan 15, 2024 at 3:30 PM EST");
    });
  });
});
