import { describe, it, expect } from "vitest";
import { getTodayInTimezone, getDateRangeInTimezone, getLastNDaysInTimezone } from "../timezone";

describe("Timezone Utilities", () => {
  describe("getTodayInTimezone", () => {
    it("should return date in YYYY-MM-DD format", () => {
      const result = getTodayInTimezone("America/New_York");
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should return a valid date string", () => {
      const result = getTodayInTimezone("America/Los_Angeles");
      const date = new Date(result);
      expect(date.toString()).not.toBe("Invalid Date");
    });
  });

  describe("getDateRangeInTimezone", () => {
    it("should convert PST date to UTC range", () => {
      const result = getDateRangeInTimezone("2026-01-15", "America/Los_Angeles");

      // PST is UTC-8, so 2026-01-15 00:00:00 PST = 2026-01-15 08:00:00 UTC
      expect(result.start.toISOString()).toBe("2026-01-15T08:00:00.000Z");

      // 2026-01-15 23:59:59.999 PST = 2026-01-16 07:59:59.999 UTC
      expect(result.end.toISOString()).toBe("2026-01-16T07:59:59.999Z");
    });

    it("should convert EST date to UTC range", () => {
      const result = getDateRangeInTimezone("2026-01-15", "America/New_York");

      // EST is UTC-5
      expect(result.start.toISOString()).toBe("2026-01-15T05:00:00.000Z");
      expect(result.end.toISOString()).toBe("2026-01-16T04:59:59.999Z");
    });

    it("should handle DST transitions (summer)", () => {
      // Test date during DST (summer)
      const summer = getDateRangeInTimezone("2026-07-15", "America/New_York");

      // EDT is UTC-4 (DST)
      expect(summer.start.toISOString()).toBe("2026-07-15T04:00:00.000Z");
      expect(summer.end.toISOString()).toBe("2026-07-16T03:59:59.999Z");
    });

    it("should handle different timezones correctly", () => {
      const tokyo = getDateRangeInTimezone("2026-03-10", "Asia/Tokyo");
      const london = getDateRangeInTimezone("2026-03-10", "Europe/London");

      // Tokyo (JST) is UTC+9
      expect(tokyo.start.getUTCHours()).toBe(15); // 00:00 JST = 15:00 previous day UTC

      // London (GMT/BST depending on time of year)
      // In March, London might be on GMT (UTC+0) or BST (UTC+1)
      const londonHour = london.start.getUTCHours();
      expect([0, 23]).toContain(londonHour); // Either 00:00 GMT or 23:00 previous day if BST
    });

    it("should return full day range", () => {
      const result = getDateRangeInTimezone("2026-05-20", "America/Chicago");

      const diffMs = result.end.getTime() - result.start.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      // Should be approximately 24 hours (within 1 second tolerance)
      expect(diffHours).toBeCloseTo(24, 2);
    });
  });

  describe("getLastNDaysInTimezone", () => {
    it("should return from and to date strings in YYYY-MM-DD format", () => {
      const result = getLastNDaysInTimezone("America/New_York", 30);
      expect(result.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should return 30 days range by default", () => {
      const result = getLastNDaysInTimezone("America/Los_Angeles");
      const from = new Date(result.from);
      const to = new Date(result.to);
      const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
      // Should be approximately 30 days (can vary by 1 due to timezone)
      expect(diffDays).toBeGreaterThanOrEqual(29);
      expect(diffDays).toBeLessThanOrEqual(31);
    });

    it("should return 7 days range when specified", () => {
      const result = getLastNDaysInTimezone("America/Chicago", 7);
      const from = new Date(result.from);
      const to = new Date(result.to);
      const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThanOrEqual(6);
      expect(diffDays).toBeLessThanOrEqual(8);
    });

    it("to date should be today in given timezone", () => {
      const result = getLastNDaysInTimezone("America/New_York", 1);
      const todayNY = getTodayInTimezone("America/New_York");
      expect(result.to).toBe(todayNY);
    });
  });
});
