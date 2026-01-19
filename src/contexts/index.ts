export {
  MerchantProvider,
  useMerchantConfig,
  useMerchantInfo,
  useTipConfig,
  useFeeConfig,
} from "./MerchantContext";
export type { MerchantConfig } from "./MerchantContext";

export { ThemeProvider, useTheme } from "./ThemeContext";

export {
  DashboardProvider,
  useDashboard,
  useMerchants,
  useCompany,
} from "./DashboardContext";
export type {
  DashboardContextValue,
  MerchantInfo as DashboardMerchantInfo,
  CompanyInfo,
} from "./DashboardContext";
