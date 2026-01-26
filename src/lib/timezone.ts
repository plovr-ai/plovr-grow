import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { startOfDay, endOfDay } from "date-fns";

/**
 * Get today's date string in a specific timezone
 * @param timezone - IANA timezone (e.g., "America/Los_Angeles")
 * @returns Date string in YYYY-MM-DD format
 */
export function getTodayInTimezone(timezone: string): string {
  const now = new Date();
  const zonedDate = toZonedTime(now, timezone);
  return zonedDate.toISOString().split("T")[0];
}

/**
 * Convert a date string (YYYY-MM-DD) to UTC date range based on timezone
 * @param dateString - Date in YYYY-MM-DD format (e.g., "2026-01-01")
 * @param timezone - IANA timezone (e.g., "America/Los_Angeles")
 * @returns Object with start and end Date objects in UTC
 */
export function getDateRangeInTimezone(
  dateString: string,
  timezone: string
): { start: Date; end: Date } {
  // Parse YYYY-MM-DD in the target timezone
  const [year, month, day] = dateString.split("-").map(Number);
  const localDate = new Date(year, month - 1, day);

  // Get start and end of day in the timezone
  const localStart = startOfDay(localDate);
  const localEnd = endOfDay(localDate);

  // Convert to UTC
  const utcStart = fromZonedTime(localStart, timezone);
  const utcEnd = fromZonedTime(localEnd, timezone);

  return { start: utcStart, end: utcEnd };
}
