export {
  MerchantProvider,
  useMerchantConfig,
  useMerchantInfo,
  useTipConfig,
  useFeeConfig,
  useCompanySlug,
  useCompanyId,
} from "./MerchantContext";
export type { MerchantConfig } from "./MerchantContext";

export {
  LoyaltyProvider,
  useLoyalty,
  useLoyaltyMember,
  useIsLoyaltyLoading,
} from "./LoyaltyContext";
export type { LoyaltyMember } from "./LoyaltyContext";

export { ThemeProvider, useTheme } from "./ThemeContext";

export {
  DashboardProvider,
  useDashboard,
  useMerchants,
  useCompany,
  useDashboardCurrency,
  useDashboardLocale,
} from "./DashboardContext";
export type {
  DashboardContextValue,
  MerchantInfo as DashboardMerchantInfo,
  CompanyInfo,
} from "./DashboardContext";
