// ==================== Merchant Data Mapper ====================
// Prisma 返回类型 → Service 业务类型的映射

import type { Prisma } from "@prisma/client";
import type { TenantSettings } from "@/types/tenant";
import type { MerchantSettings, MerchantStatus, BusinessHoursMap } from "@/types/merchant";
import type { MerchantWithCompany, CompanyWithMerchants } from "./merchant.types";

// Prisma return types for Merchant with Tenant
type MerchantWithTenant = Prisma.MerchantGetPayload<{
  include: {
    tenant: true;
  };
}>;

// Prisma return types for Tenant with Merchants
type TenantWithMerchants = Prisma.TenantGetPayload<{
  include: {
    merchants: true;
  };
}>;

// Merchant item from tenant query (without nested tenant)
type MerchantFromTenantQuery = Prisma.MerchantGetPayload<object>;

/**
 * 将 Prisma Merchant (with Tenant) 转换为 Service 类型
 */
export function toMerchantWithCompany(
  data: MerchantWithTenant
): MerchantWithCompany {
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    tenantId: data.tenantId,
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
      id: data.tenant.id,
      slug: data.tenant.slug,
      tenantId: data.tenant.id,
      name: data.tenant.name,
      logoUrl: data.tenant.logoUrl ?? undefined,
      settings: data.tenant.settings as TenantSettings | undefined,
      tenant: {
        id: data.tenant.id,
        name: data.tenant.name,
        subscriptionStatus: data.tenant.subscriptionStatus,
      },
    },
  };
}

/**
 * 将 Prisma Tenant (with Merchants) 转换为 Service 类型
 */
export function toCompanyWithMerchants(
  data: TenantWithMerchants
): CompanyWithMerchants {
  return {
    id: data.id,
    slug: data.slug,
    tenantId: data.id,
    name: data.name,
    description: data.description ?? undefined,
    logoUrl: data.logoUrl ?? undefined,
    settings: data.settings as TenantSettings | undefined,
    tenant: {
      id: data.id,
      name: data.name,
      subscriptionStatus: data.subscriptionStatus,
    },
    merchants: data.merchants.map((m) => toMerchantFromTenant(m, data)),
  };
}

/**
 * Convert a merchant from tenant query to MerchantWithCompany type
 */
function toMerchantFromTenant(
  merchant: MerchantFromTenantQuery,
  tenant: TenantWithMerchants
): MerchantWithCompany {
  return {
    id: merchant.id,
    slug: merchant.slug,
    name: merchant.name,
    tenantId: merchant.tenantId,
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
      id: tenant.id,
      slug: tenant.slug,
      tenantId: tenant.id,
      name: tenant.name,
      logoUrl: tenant.logoUrl ?? undefined,
      settings: tenant.settings as TenantSettings | undefined,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subscriptionStatus: tenant.subscriptionStatus,
      },
    },
  };
}
