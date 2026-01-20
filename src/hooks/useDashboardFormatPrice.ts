"use client";

import { useCallback } from "react";
import { formatPrice } from "@/lib/utils";
import { useDashboardCurrency, useDashboardLocale } from "@/contexts";

/**
 * Hook for formatting prices in Dashboard pages
 * Uses currency and locale from DashboardContext
 */
export function useDashboardFormatPrice() {
  const currency = useDashboardCurrency();
  const locale = useDashboardLocale();

  return useCallback(
    (price: number | string) => formatPrice(price, currency, locale),
    [currency, locale]
  );
}

/**
 * Hook for getting the currency symbol in Dashboard pages
 */
export function useDashboardCurrencySymbol() {
  const currency = useDashboardCurrency();
  const locale = useDashboardLocale();

  // Get currency symbol by formatting 0 and extracting the symbol
  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(0);

  // Extract symbol (remove digits and whitespace)
  return formatted.replace(/[\d\s]/g, "").trim();
}
