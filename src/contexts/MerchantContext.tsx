"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  type TipConfig,
  DEFAULT_TIP_CONFIG,
  type FeeConfig,
  DEFAULT_FEE_CONFIG,
} from "@/types";

export interface MerchantConfig {
  name: string;
  logoUrl: string | null;
  currency: string;
  locale: string;
  timezone: string;
  tipConfig: TipConfig;
  feeConfig: FeeConfig;
  companySlug: string | null;
}

interface MerchantProviderProps {
  children: ReactNode;
  config: {
    name: string;
    logoUrl: string | null;
    currency: string;
    locale: string;
    timezone: string;
    tipConfig?: TipConfig;
    feeConfig?: FeeConfig;
    companySlug?: string | null;
  };
}

const MerchantContext = createContext<MerchantConfig | null>(null);

export function MerchantProvider({ children, config }: MerchantProviderProps) {
  const fullConfig = useMemo<MerchantConfig>(
    () => ({
      name: config.name,
      logoUrl: config.logoUrl,
      currency: config.currency,
      locale: config.locale,
      timezone: config.timezone,
      tipConfig: config.tipConfig ?? DEFAULT_TIP_CONFIG,
      feeConfig: config.feeConfig ?? DEFAULT_FEE_CONFIG,
      companySlug: config.companySlug ?? null,
    }),
    [config.name, config.logoUrl, config.currency, config.locale, config.timezone, config.tipConfig, config.feeConfig, config.companySlug]
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

export function useFeeConfig(): FeeConfig {
  const { feeConfig } = useMerchantConfig();
  return feeConfig;
}

export function useMerchantInfo(): { name: string; logoUrl: string | null } {
  const { name, logoUrl } = useMerchantConfig();
  return { name, logoUrl };
}

export function useTimezone(): string {
  const { timezone } = useMerchantConfig();
  return timezone;
}

export function useCompanySlug(): string | null {
  const { companySlug } = useMerchantConfig();
  return companySlug;
}
