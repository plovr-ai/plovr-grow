import { useMemo } from "react";
import { useMerchantConfig } from "@/contexts/MerchantContext";

/**
 * Hook to get the currency symbol based on merchant config
 * Uses Intl.NumberFormat to extract the currency symbol
 */
export function useCurrencySymbol(): string {
  const { currency, locale } = useMerchantConfig();

  return useMemo(() => {
    const formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    });
    const parts = formatter.formatToParts(0);
    const symbolPart = parts.find((part) => part.type === "currency");
    return symbolPart?.value ?? currency;
  }, [currency, locale]);
}
