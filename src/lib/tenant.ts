import { headers } from "next/headers";
import { cache } from "react";

// ==================== Merchant Context ====================

export interface MerchantContext {
  merchantId: string;
  merchantSlug: string;
  companyId: string;
  tenantId: string;
}

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
