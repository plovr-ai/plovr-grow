import { headers } from "next/headers";
import { cache } from "react";

// Mock merchant data for development
// TODO: Replace with real database queries when ready
const MOCK_MERCHANTS: Record<
  string,
  {
    id: string;
    slug: string;
    name: string;
    companyId: string;
    company: {
      id: string;
      tenantId: string;
      name: string;
      tenant: {
        id: string;
        name: string;
      };
    };
  }
> = {
  "joes-pizza": {
    id: "merchant-joes-pizza",
    slug: "joes-pizza",
    name: "Joe's Pizza",
    companyId: "company-joes",
    company: {
      id: "company-joes",
      tenantId: "tenant-joes",
      name: "Joe's Pizza Inc.",
      tenant: {
        id: "tenant-joes",
        name: "Joe's Pizza",
      },
    },
  },
};

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
 * Get merchant by slug (mock implementation)
 * TODO: Replace with database query when ready
 */
export async function getMerchantBySlug(slug: string) {
  // Return mock data for development
  return MOCK_MERCHANTS[slug] ?? null;
}

/**
 * Get tenant by ID (mock implementation)
 * TODO: Replace with database query when ready
 */
export async function getTenantById(id: string) {
  // Find merchant by tenant ID
  const merchant = Object.values(MOCK_MERCHANTS).find(
    (m) => m.company.tenantId === id
  );
  if (!merchant) return null;

  return {
    id: merchant.company.tenant.id,
    name: merchant.company.tenant.name,
    company: {
      id: merchant.company.id,
      name: merchant.company.name,
      merchants: [merchant],
    },
  };
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
