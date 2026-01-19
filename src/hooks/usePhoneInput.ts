"use client";

import { useCallback } from "react";
import { formatPhoneInput } from "@/lib/utils";
import { useMerchantConfig } from "@/contexts";

export function usePhoneInput() {
  const { locale } = useMerchantConfig();

  const format = useCallback(
    (value: string) => formatPhoneInput(value, locale),
    [locale]
  );

  // Extract raw digits for form submission/validation
  const getRawValue = useCallback((formatted: string) => {
    return formatted.replace(/\D/g, "");
  }, []);

  return { format, getRawValue };
}
