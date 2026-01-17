import { headers } from "next/headers";
import { cache } from "react";

// ==================== Legacy Types (for backward compatibility) ====================

export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
}

// ==================== Merchant Context ====================

export interface MerchantContext {
  merchantId: string;
  merchantSlug: string;
  companyId: string;
  tenantId: string;
}

/**
 * Get tenant context from the current request (legacy)
 * @deprecated Use getMerchantContext instead
 */
export const getTenantContext = cache(
  async (): Promise<TenantContext | null> => {
    const headersList = await headers();

    const tenantId = headersList.get("x-tenant-id");
    const tenantSlug = headersList.get("x-tenant-slug");

    if (tenantId && tenantSlug) {
      return { tenantId, tenantSlug };
    }

    return null;
  }
);

/**
 * Get merchant context from the current request
 */
export const getMerchantContext = cache(
  async (): Promise<MerchantContext | null> => {
    const headersList = await headers();

    const merchantId = headersList.get("x-merchant-id");
    const merchantSlug = headersList.get("x-merchant-slug");
    const companyId = headersList.get("x-company-id");
    const tenantId = headersList.get("x-tenant-id");

    if (merchantId && merchantSlug && companyId && tenantId) {
      return { merchantId, merchantSlug, companyId, tenantId };
    }

    return null;
  }
);

/**
 * Require tenant context - throws if not available
 * @deprecated Use requireMerchantContext instead
 */
export async function requireTenantContext(): Promise<TenantContext> {
  const context = await getTenantContext();
  if (!context) {
    throw new Error("Tenant context is required");
  }
  return context;
}

/**
 * Require merchant context - throws if not available
 */
export async function requireMerchantContext(): Promise<MerchantContext> {
  const context = await getMerchantContext();
  if (!context) {
    throw new Error("Merchant context is required");
  }
  return context;
}

/**
 * Extract merchant slug from pathname
 * Supports pattern: /r/{merchant-slug}/...
 */
export function extractMerchantSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/r\/([^/]+)/);
  return match ? match[1] : null;
}

/**
 * @deprecated Use extractMerchantSlugFromPath instead
 */
export function extractTenantSlugFromPath(pathname: string): string | null {
  return extractMerchantSlugFromPath(pathname);
}

/**
 * Extract company slug from pathname
 * Supports pattern: /{company-slug}/...
 * Excludes reserved paths: dashboard, admin, api, r, _next
 */
export function extractCompanySlugFromPath(pathname: string): string | null {
  const RESERVED_SLUGS = [
    "dashboard",
    "admin",
    "api",
    "r",
    "_next",
    "favicon.ico",
  ];
  const match = pathname.match(/^\/([^/]+)/);
  if (!match) return null;

  const slug = match[1];
  if (RESERVED_SLUGS.includes(slug)) return null;

  return slug;
}
