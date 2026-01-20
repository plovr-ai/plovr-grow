export {
  MerchantProvider,
  useMerchantConfig,
  useMerchantInfo,
  useTipConfig,
  useFeeConfig,
  useCompanySlug,
} from "./MerchantContext";
export type { MerchantConfig } from "./MerchantContext";

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
