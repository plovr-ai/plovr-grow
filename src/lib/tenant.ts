import { headers } from "next/headers";
import { cache } from "react";
import prisma from "./db";

// ==================== Legacy Types (for backward compatibility) ====================

export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
}

// ==================== New Merchant Context ====================

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
 * Get merchant by slug from database (for public URL routing)
 */
export async function getMerchantBySlug(slug: string) {
  return prisma.merchant.findUnique({
    where: { slug },
    include: {
      company: {
        include: {
          tenant: true,
        },
      },
    },
  });
}

/**
 * Get tenant by ID from database
 */
export async function getTenantById(id: string) {
  return prisma.tenant.findUnique({
    where: { id },
    include: {
      company: {
        include: {
          merchants: true,
        },
      },
    },
  });
}

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
