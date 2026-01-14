import { headers } from "next/headers";
import { cache } from "react";
import prisma from "./db";

export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
}

/**
 * Get tenant context from the current request
 * Extracts tenant information from URL path or headers
 */
export const getTenantContext = cache(async (): Promise<TenantContext | null> => {
  const headersList = await headers();

  // Try to get tenant from custom header (set by middleware)
  const tenantId = headersList.get("x-tenant-id");
  const tenantSlug = headersList.get("x-tenant-slug");

  if (tenantId && tenantSlug) {
    return { tenantId, tenantSlug };
  }

  return null;
});

/**
 * Get tenant by slug from database
 */
export async function getTenantBySlug(slug: string) {
  return prisma.tenant.findUnique({
    where: { slug },
    include: {
      merchant: true,
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
      merchant: true,
    },
  });
}

/**
 * Require tenant context - throws if not available
 */
export async function requireTenantContext(): Promise<TenantContext> {
  const context = await getTenantContext();
  if (!context) {
    throw new Error("Tenant context is required");
  }
  return context;
}

/**
 * Extract tenant slug from pathname
 * Supports pattern: /r/{tenant-slug}/...
 */
export function extractTenantSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/r\/([^/]+)/);
  return match ? match[1] : null;
}
