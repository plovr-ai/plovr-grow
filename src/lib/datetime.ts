/**
 * Date/time formatting utilities with timezone support.
 *
 * All functions accept a date (Date object or ISO string), timezone (IANA format),
 * and locale (BCP 47 format) to format dates according to the merchant's local time.
 */

/**
 * Converts a date to the specified timezone and formats it.
 */
export function formatDateTime(
  date: Date | string,
  timezone: string,
  locale: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...options,
  };

  return dateObj.toLocaleString(locale, defaultOptions);
}

/**
 * Formats only the date portion (e.g., "Jan 15, 2024").
 */
export function formatDate(
  date: Date | string,
  timezone: string,
  locale: string
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  return dateObj.toLocaleDateString(locale, {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Formats only the time portion (e.g., "3:30 PM").
 */
export function formatTime(
  date: Date | string,
  timezone: string,
  locale: string
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  return dateObj.toLocaleTimeString(locale, {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Gets the timezone abbreviation for a given IANA timezone.
 * Returns abbreviations like "PST", "EST", "PDT", etc.
 *
 * Note: The abbreviation may change based on DST, so a date is needed.
 */
export function getTimezoneAbbr(timezone: string, date?: Date): string {
  const dateObj = date ?? new Date();

  // Use Intl.DateTimeFormat to get the timezone abbreviation
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "short",
  });

  const parts = formatter.formatToParts(dateObj);
  const timeZonePart = parts.find((part) => part.type === "timeZoneName");

  return timeZonePart?.value ?? timezone;
}

/**
 * Formats date with timezone abbreviation annotation.
 * Useful for dashboard where orders from different timezones are displayed together.
 * Example: "Jan 15, 2024 at 3:30 PM PST"
 */
export function formatDateTimeWithTimezone(
  date: Date | string,
  timezone: string,
  locale: string
): string {
  const dateStr = formatDate(date, timezone, locale);
  const timeStr = formatTime(date, timezone, locale);
  const tzAbbr = getTimezoneAbbr(timezone, typeof date === "string" ? new Date(date) : date);

  return `${dateStr} at ${timeStr} ${tzAbbr}`;
}
