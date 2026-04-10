"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { DashboardSubscriptionInfo } from "@/services/subscription/subscription.types";
import type { OnboardingData, OnboardingStatus } from "@/types/onboarding";

export interface MerchantInfo {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  city: string | null;
  status: string;
}

export interface TenantBrandInfo {
  id: string;
  name: string;
  slug: string | null;
  logoUrl: string | null;
}

export interface DashboardContextValue {
  tenantId: string;
  tenant: TenantBrandInfo;
  merchants: MerchantInfo[];
  currency: string;
  locale: string;
  subscription: DashboardSubscriptionInfo | null;
  onboarding: {
    status: OnboardingStatus;
    data: OnboardingData | null;
  };
}

interface DashboardProviderProps {
  children: ReactNode;
  value: DashboardContextValue;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children, value }: DashboardProviderProps) {
  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardContextValue {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within DashboardProvider");
  }
  return context;
}

export function useMerchants(): MerchantInfo[] {
  const { merchants } = useDashboard();
  return merchants;
}

export function useTenantBrand(): TenantBrandInfo {
  const { tenant } = useDashboard();
  return tenant;
}

export function useDashboardCurrency(): string {
  const { currency } = useDashboard();
  return currency;
}

export function useDashboardLocale(): string {
  const { locale } = useDashboard();
  return locale;
}

export function useOnboarding() {
  const { onboarding } = useDashboard();
  return onboarding;
}
