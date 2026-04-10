"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useMerchantConfig } from "./MerchantContext";

export interface LoyaltyMember {
  id: string;
  phone: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  points: number;
}

interface LoyaltyContextValue {
  // State
  member: LoyaltyMember | null;
  isLoading: boolean;
  pointsPerDollar: number;

  // Actions
  login: (member: LoyaltyMember, pointsPerDollar: number) => void;
  logout: () => Promise<void>;
  refreshMember: () => Promise<void>;
}

const LoyaltyContext = createContext<LoyaltyContextValue | null>(null);

interface LoyaltyProviderProps {
  children: ReactNode;
}

export function LoyaltyProvider({ children }: LoyaltyProviderProps) {
  const { tenantId } = useMerchantConfig();

  const [member, setMember] = useState<LoyaltyMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pointsPerDollar, setPointsPerDollar] = useState(1);

  // Fetch member data from /me API on mount
  const fetchMember = useCallback(async () => {
    if (!tenantId) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/storefront/loyalty/me?tenantId=${encodeURIComponent(tenantId)}`
      );
      const data = await response.json();

      if (data.success && data.data) {
        setMember(data.data.member);
        setPointsPerDollar(data.data.pointsPerDollar);
      } else {
        setMember(null);
      }
    } catch (error) {
      console.error("[LoyaltyContext] Failed to fetch member:", error);
      setMember(null);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  // Initialize on mount
  useEffect(() => {
    fetchMember();
  }, [fetchMember]);

  // Login: update state after successful OTP verification
  // Cookie is already set by the API, this just updates the UI state
  const login = useCallback((member: LoyaltyMember, ppd: number) => {
    setMember(member);
    setPointsPerDollar(ppd);
  }, []);

  // Logout: call API to clear cookie and reset state
  const logout = useCallback(async () => {
    if (!tenantId) return;

    try {
      await fetch("/api/storefront/loyalty/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tenantId }),
      });
    } catch (error) {
      console.error("[LoyaltyContext] Failed to logout:", error);
    } finally {
      setMember(null);
    }
  }, [tenantId]);

  // Refresh member data from API
  const refreshMember = useCallback(async () => {
    if (!tenantId || !member) return;
    await fetchMember();
  }, [tenantId, member, fetchMember]);

  const value: LoyaltyContextValue = {
    member,
    isLoading,
    pointsPerDollar,
    login,
    logout,
    refreshMember,
  };

  return (
    <LoyaltyContext.Provider value={value}>{children}</LoyaltyContext.Provider>
  );
}

export function useLoyalty(): LoyaltyContextValue {
  const context = useContext(LoyaltyContext);
  if (!context) {
    throw new Error("useLoyalty must be used within LoyaltyProvider");
  }
  return context;
}

export function useLoyaltyMember(): LoyaltyMember | null {
  const { member } = useLoyalty();
  return member;
}

export function useIsLoyaltyLoading(): boolean {
  const { isLoading } = useLoyalty();
  return isLoading;
}
