// ==================== Merchant Data Mapper ====================
// Prisma 返回类型 → Service 业务类型的映射

import type { Prisma } from "@prisma/client";
import type { CompanySettings } from "@/types/company";
import type { MerchantSettings, MerchantStatus, BusinessHoursMap } from "@/types/merchant";
import type { MerchantWithCompany, CompanyWithMerchants } from "./merchant.types";

// Prisma return types for Merchant with Company and Tenant
type MerchantWithCompanyAndTenant = Prisma.MerchantGetPayload<{
  include: {
    company: {
      include: {
        tenant: true;
      };
    };
  };
}>;

// Prisma return types for Company with Merchants and Tenant
type CompanyWithMerchantsAndTenant = Prisma.CompanyGetPayload<{
  include: {
    tenant: true;
    merchants: true;
  };
}>;

// Merchant item from company query (without nested company)
type MerchantFromCompanyQuery = Prisma.MerchantGetPayload<{}>;

/**
 * 将 Prisma Merchant (with Company) 转换为 Service 类型
 */
export function toMerchantWithCompany(
  data: MerchantWithCompanyAndTenant
): MerchantWithCompany {
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    companyId: data.companyId,
    description: data.description ?? undefined,
    address: data.address ?? undefined,
    city: data.city ?? undefined,
    state: data.state ?? undefined,
    zipCode: data.zipCode ?? undefined,
    country: data.country,
    phone: data.phone ?? undefined,
    email: data.email ?? undefined,
    logoUrl: data.logoUrl ?? undefined,
    bannerUrl: data.bannerUrl ?? undefined,
    businessHours: data.businessHours as BusinessHoursMap | undefined,
    timezone: data.timezone,
    currency: data.currency,
    locale: data.locale,
    status: data.status as MerchantStatus,
    settings: (data.settings as unknown) as MerchantSettings | undefined,
    company: {
      id: data.company.id,
      slug: data.company.slug,
      tenantId: data.company.tenantId,
      name: data.company.name,
      logoUrl: data.company.logoUrl ?? undefined,
      settings: data.company.settings as CompanySettings | undefined,
      tenant: {
        id: data.company.tenant.id,
        name: data.company.tenant.name,
        subscriptionStatus: data.company.tenant.subscriptionStatus,
      },
    },
  };
}

/**
 * 将 Prisma Company (with Merchants) 转换为 Service 类型
 */
export function toCompanyWithMerchants(
  data: CompanyWithMerchantsAndTenant
): CompanyWithMerchants {
  return {
    id: data.id,
    slug: data.slug,
    tenantId: data.tenantId,
    name: data.name,
    description: data.description ?? undefined,
    logoUrl: data.logoUrl ?? undefined,
    settings: data.settings as CompanySettings | undefined,
    tenant: {
      id: data.tenant.id,
      name: data.tenant.name,
      subscriptionStatus: data.tenant.subscriptionStatus,
    },
    merchants: data.merchants.map((m) => toMerchantFromCompany(m, data)),
  };
}

/**
 * Convert a merchant from company query to MerchantWithCompany type
 */
function toMerchantFromCompany(
  merchant: MerchantFromCompanyQuery,
  company: CompanyWithMerchantsAndTenant
): MerchantWithCompany {
  return {
    id: merchant.id,
    slug: merchant.slug,
    name: merchant.name,
    companyId: merchant.companyId,
    description: merchant.description ?? undefined,
    address: merchant.address ?? undefined,
    city: merchant.city ?? undefined,
    state: merchant.state ?? undefined,
    zipCode: merchant.zipCode ?? undefined,
    country: merchant.country,
    phone: merchant.phone ?? undefined,
    email: merchant.email ?? undefined,
    logoUrl: merchant.logoUrl ?? undefined,
    bannerUrl: merchant.bannerUrl ?? undefined,
    businessHours: merchant.businessHours as BusinessHoursMap | undefined,
    timezone: merchant.timezone,
    currency: merchant.currency,
    locale: merchant.locale,
    status: merchant.status as MerchantStatus,
    settings: (merchant.settings as unknown) as MerchantSettings | undefined,
    company: {
      id: company.id,
      slug: company.slug,
      tenantId: company.tenantId,
      name: company.name,
      logoUrl: company.logoUrl ?? undefined,
      settings: company.settings as CompanySettings | undefined,
      tenant: {
        id: company.tenant.id,
        name: company.tenant.name,
        subscriptionStatus: company.tenant.subscriptionStatus,
      },
    },
  };
}
