"use client";

import { useCallback, useMemo } from "react";
import { useDashboardLocale } from "@/contexts";
import {
  formatDate as formatDateUtil,
  formatTime as formatTimeUtil,
  formatDateTime as formatDateTimeUtil,
  getTimezoneAbbr,
} from "@/lib/datetime";

/**
 * Hook for formatting dates and times in Dashboard pages.
 * Uses locale from DashboardContext and accepts timezone as parameter.
 *
 * Usage:
 * ```tsx
 * const { formatDate, formatTime, timezone, timezoneAbbr } = useDashboardFormatDateTime(order.merchant?.timezone);
 *
 * // Format order timestamp
 * <span>{formatDate(order.createdAt)} at {formatTime(order.createdAt)}</span>
 * ```
 */
export function useDashboardFormatDateTime(timezone: string = "America/New_York") {
  const locale = useDashboardLocale();

  const formatDate = useCallback(
    (date: Date | string) => formatDateUtil(date, timezone, locale),
    [timezone, locale]
  );

  const formatTime = useCallback(
    (date: Date | string) => formatTimeUtil(date, timezone, locale),
    [timezone, locale]
  );

  const formatDateTime = useCallback(
    (date: Date | string, options?: Intl.DateTimeFormatOptions) =>
      formatDateTimeUtil(date, timezone, locale, options),
    [timezone, locale]
  );

  const timezoneAbbr = useMemo(
    () => getTimezoneAbbr(timezone),
    [timezone]
  );

  return {
    formatDate,
    formatTime,
    formatDateTime,
    timezone,
    timezoneAbbr,
  };
}
