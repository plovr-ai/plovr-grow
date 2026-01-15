"use client";

import { useCallback } from "react";
import { formatPrice } from "@/lib/utils";
import { useMerchantConfig } from "@/contexts";

export function useFormatPrice() {
  const { currency, locale } = useMerchantConfig();

  return useCallback(
    (price: number | string) => formatPrice(price, currency, locale),
    [currency, locale]
  );
}
