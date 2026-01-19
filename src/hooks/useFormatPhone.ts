"use client";

import { useCallback } from "react";
import { formatPhone } from "@/lib/utils";
import { useMerchantConfig } from "@/contexts";

export function useFormatPhone() {
  const { locale } = useMerchantConfig();

  return useCallback(
    (phone: string | null | undefined) => {
      if (!phone) return "";
      return formatPhone(phone, locale);
    },
    [locale]
  );
}
