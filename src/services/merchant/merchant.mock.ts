// ==================== Mock Data for Merchant Service ====================
// TODO: Replace with Repository layer when database is ready

import type { CompanySettings } from "@/types/company";

// ==================== Mock Data Types ====================

export interface MockMerchant {
  id: string;
  slug: string;
  name: string;
  companyId: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  bannerUrl?: string;
  timezone: string;
  currency: string;
  locale: string;
  taxRate: number;
  status: "active" | "inactive" | "temporarily_closed";
  company: MockCompanyRef;
}

export interface MockCompanyRef {
  id: string;
  slug: string;
  tenantId: string;
  name: string;
  settings?: CompanySettings;
  tenant: {
    id: string;
    name: string;
  };
}

export interface MockCompany {
  id: string;
  slug: string;
  tenantId: string;
  name: string;
  description?: string;
  logoUrl?: string;
  settings?: CompanySettings;
  tenant: {
    id: string;
    name: string;
  };
  merchants: MockMerchant[];
}

// ==================== Mock Company Data ====================

const JOES_PIZZA_SETTINGS: CompanySettings = {
  themePreset: "red",
};

const JOES_PIZZA_COMPANY_REF: MockCompanyRef = {
  id: "company-joes",
  slug: "joes-pizza",
  tenantId: "tenant-joes",
  name: "Joe's Pizza Inc.",
  settings: JOES_PIZZA_SETTINGS,
  tenant: {
    id: "tenant-joes",
    name: "Joe's Pizza",
  },
};

const MOCK_COMPANIES: Record<string, MockCompany> = {
  "joes-pizza": {
    id: "company-joes",
    slug: "joes-pizza",
    tenantId: "tenant-joes",
    name: "Joe's Pizza Inc.",
    description: "Authentic New York Style Pizza since 1975",
    logoUrl: "/images/joes-pizza-logo.png",
    settings: JOES_PIZZA_SETTINGS,
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
        description: "Our flagship downtown location",
        address: "123 Main St",
        city: "New York",
        state: "NY",
        zipCode: "10001",
        country: "US",
        phone: "(212) 555-0100",
        email: "downtown@joespizza.com",
        timezone: "America/New_York",
        currency: "USD",
        locale: "en-US",
        taxRate: 0.08875,
        status: "active",
        company: JOES_PIZZA_COMPANY_REF,
      },
      {
        id: "merchant-joes-midtown",
        slug: "joes-pizza-midtown",
        name: "Joe's Pizza - Midtown",
        companyId: "company-joes",
        description: "Convenient midtown location",
        address: "456 Broadway",
        city: "New York",
        state: "NY",
        zipCode: "10018",
        country: "US",
        phone: "(212) 555-0200",
        email: "midtown@joespizza.com",
        timezone: "America/New_York",
        currency: "USD",
        locale: "en-US",
        taxRate: 0.08875,
        status: "active",
        company: JOES_PIZZA_COMPANY_REF,
      },
    ],
  },
};

// ==================== Mock Merchant Data ====================

const MOCK_MERCHANTS: Record<string, MockMerchant> = {
  // Legacy single-store slug (for backward compatibility)
  "joes-pizza": MOCK_COMPANIES["joes-pizza"].merchants[0],
  // Multi-store slugs
  "joes-pizza-downtown": MOCK_COMPANIES["joes-pizza"].merchants[0],
  "joes-pizza-midtown": MOCK_COMPANIES["joes-pizza"].merchants[1],
};

// ==================== Mock Data Access Functions ====================

export function getMockMerchantBySlug(slug: string): MockMerchant | null {
  return MOCK_MERCHANTS[slug] ?? null;
}

export function getMockMerchantById(id: string): MockMerchant | null {
  return Object.values(MOCK_MERCHANTS).find((m) => m.id === id) ?? null;
}

export function getMockCompanyBySlug(slug: string): MockCompany | null {
  return MOCK_COMPANIES[slug] ?? null;
}

export function getMockMerchantsByCompanyId(companyId: string): MockMerchant[] {
  const company = Object.values(MOCK_COMPANIES).find((c) => c.id === companyId);
  return company?.merchants ?? [];
}

export function isMockSlugAvailable(
  slug: string,
  excludeMerchantId?: string
): boolean {
  const existing = MOCK_MERCHANTS[slug];
  if (!existing) return true;
  if (excludeMerchantId && existing.id === excludeMerchantId) return true;
  return false;
}
