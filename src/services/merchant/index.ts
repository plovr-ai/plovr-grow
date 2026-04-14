// Merchant Service - 商户服务模块
// 使用方应从此入口导入 Service 和类型

export { merchantService } from "./merchant.service";

export type {
  MerchantWithTenant,
  TenantWithMerchants,
  MerchantBasic,
  CreateMerchantInput,
  UpdateMerchantInput,
  UpdateMerchantSettingsInput,
  GetMerchantsFilter,
  WebsiteMerchantData,
} from "./merchant.types";
