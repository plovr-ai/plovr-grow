"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { type TipConfig, DEFAULT_TIP_CONFIG } from "@/types";

export interface MerchantConfig {
  currency: string;
  locale: string;
  tipConfig: TipConfig;
}

interface MerchantProviderProps {
  children: ReactNode;
  config: {
    currency: string;
    locale: string;
    tipConfig?: TipConfig;
  };
}

const MerchantContext = createContext<MerchantConfig | null>(null);

export function MerchantProvider({ children, config }: MerchantProviderProps) {
  const fullConfig = useMemo<MerchantConfig>(
    () => ({
      currency: config.currency,
      locale: config.locale,
      tipConfig: config.tipConfig ?? DEFAULT_TIP_CONFIG,
    }),
    [config.currency, config.locale, config.tipConfig]
  );

  return (
    <MerchantContext.Provider value={fullConfig}>
      {children}
    </MerchantContext.Provider>
  );
}

export function useMerchantConfig(): MerchantConfig {
  const context = useContext(MerchantContext);
  if (!context) {
    throw new Error("useMerchantConfig must be used within MerchantProvider");
  }
  return context;
}

export function useTipConfig(): TipConfig {
  const { tipConfig } = useMerchantConfig();
  return tipConfig;
}
