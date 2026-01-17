import { headers } from "next/headers";
import { cache } from "react";

// ==================== Mock Data Types ====================

interface MockMerchant {
  id: string;
  slug: string;
  name: string;
  companyId: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  company: {
    id: string;
    slug: string;
    tenantId: string;
    name: string;
    tenant: {
      id: string;
      name: string;
    };
  };
}

interface MockCompany {
  id: string;
  slug: string;
  tenantId: string;
  name: string;
  description?: string;
  logoUrl?: string;
  tenant: {
    id: string;
    name: string;
  };
  merchants: MockMerchant[];
}

// ==================== Mock Company Data ====================
// TODO: Replace with real database queries when ready

const MOCK_COMPANIES: Record<string, MockCompany> = {
  "joes-pizza": {
    id: "company-joes",
    slug: "joes-pizza",
    tenantId: "tenant-joes",
    name: "Joe's Pizza Inc.",
    description: "Authentic New York Style Pizza since 1975",
    logoUrl: "/images/joes-pizza-logo.png",
    tenant: {
      id: "tenant-joes",
      name: "Joe's Pizza",
    },
    merchants: [
      {
        id: "merchant-joes-downtown",
        slug: "joes-pizza-downtown",
        name: "Joe's Pizza - Downtown",
        companyId: "company-joes",
        address: "123 Main St",
        city: "New York",
        state: "NY",
        phone: "(212) 555-0100",
        company: {
          id: "company-joes",
          slug: "joes-pizza",
          tenantId: "tenant-joes",
          name: "Joe's Pizza Inc.",
          tenant: {
            id: "tenant-joes",
            name: "Joe's Pizza",
          },
        },
      },
      {
        id: "merchant-joes-midtown",
        slug: "joes-pizza-midtown",
        name: "Joe's Pizza - Midtown",
        companyId: "company-joes",
        address: "456 Broadway",
        city: "New York",
        state: "NY",
        phone: "(212) 555-0200",
        company: {
          id: "company-joes",
          slug: "joes-pizza",
          tenantId: "tenant-joes",
          name: "Joe's Pizza Inc.",
          tenant: {
            id: "tenant-joes",
            name: "Joe's Pizza",
          },
        },
      },
    ],
  },
};

// ==================== Mock Merchant Data ====================
// TODO: Replace with real database queries when ready

const MOCK_MERCHANTS: Record<string, MockMerchant> = {
  // Legacy single-store slug (for backward compatibility)
  "joes-pizza": MOCK_COMPANIES["joes-pizza"].merchants[0],
  // Multi-store slugs
  "joes-pizza-downtown": MOCK_COMPANIES["joes-pizza"].merchants[0],
  "joes-pizza-midtown": MOCK_COMPANIES["joes-pizza"].merchants[1],
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
 * Get company by slug (mock implementation)
 * Used for brand-level pages like website homepage
 * TODO: Replace with database query when ready
 */
export async function getCompanyBySlug(slug: string) {
  // Return mock data for development
  return MOCK_COMPANIES[slug] ?? null;
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
