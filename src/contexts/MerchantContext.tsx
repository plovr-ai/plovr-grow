"use client";

import { createContext, useContext, type ReactNode } from "react";

export interface MerchantConfig {
  currency: string;
  locale: string;
}

const MerchantContext = createContext<MerchantConfig | null>(null);

interface MerchantProviderProps {
  children: ReactNode;
  config: MerchantConfig;
}

export function MerchantProvider({ children, config }: MerchantProviderProps) {
  return (
    <MerchantContext.Provider value={config}>
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
