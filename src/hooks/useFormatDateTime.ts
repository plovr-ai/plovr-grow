"use client";

import { useCallback, useMemo } from "react";
import { useMerchantConfig } from "@/contexts";
import {
  formatDate as formatDateUtil,
  formatTime as formatTimeUtil,
  formatDateTime as formatDateTimeUtil,
  getTimezoneAbbr,
} from "@/lib/datetime";

/**
 * Hook for formatting dates and times using the merchant's timezone and locale.
 *
 * Usage:
 * ```tsx
 * const { formatDate, formatTime, formatDateTime, timezone, timezoneAbbr } = useFormatDateTime();
 *
 * // Format order timestamp
 * <span>{formatDate(order.createdAt)} at {formatTime(order.createdAt)}</span>
 * ```
 */
export function useFormatDateTime() {
  const { timezone, locale } = useMerchantConfig();

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
