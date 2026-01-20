"use client";

import { createContext, useContext, type ReactNode } from "react";

export interface MerchantInfo {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  city: string | null;
  status: string;
}

export interface CompanyInfo {
  id: string;
  name: string;
  slug: string | null;
  logoUrl: string | null;
}

export interface DashboardContextValue {
  tenantId: string;
  companyId: string;
  company: CompanyInfo;
  merchants: MerchantInfo[];
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

export function useCompany(): CompanyInfo {
  const { company } = useDashboard();
  return company;
}
