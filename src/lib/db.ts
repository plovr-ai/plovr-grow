import { PrismaClient } from "@prisma/client";

/**
 * Mock Prisma Client
 * TODO: Replace with real PrismaClient when database is ready
 *
 * This mock returns empty results for all queries.
 * The real PrismaClient type is used for type compatibility.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock data for Bella's Bakery
const mockBellasMerchant = {
  id: "merchant-bellas-sf",
  tenantId: "tenant-bellas-bakery",
  companyId: "company-bellas-bakery",
  name: "Bella's Bakery (SF)",
  slug: "bellas-bakery-sf",
  description: "Fresh baked goods daily",
  address: "456 Valencia St",
  city: "San Francisco",
  state: "CA",
  zipCode: "94103",
  country: "US",
  phone: "+1-415-555-0123",
  email: "sf@bellas-bakery.com",
  timezone: "America/Los_Angeles",
  currency: "USD",
  locale: "en-US",
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
  company: {
    id: "company-bellas-bakery",
    tenantId: "tenant-bellas-bakery",
    name: "Bella's Bakery",
    slug: "bellas-bakery",
    legalName: "Bella's Bakery LLC",
    status: "active",
    onboardingStatus: "completed",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

// Helper to create mock model methods that return null/empty
const mockMethods = {
  findMany: async () => [],
  findFirst: async () => null,
  findUnique: async () => null,
  create: async (args: any) => ({ id: `mock-${Date.now()}`, ...args?.data }),
  createMany: async () => ({ count: 0 }),
  update: async () => ({}),
  updateMany: async () => ({ count: 0 }),
  upsert: async () => ({}),
  delete: async () => ({}),
  deleteMany: async () => ({ count: 0 }),
  count: async () => 0,
  aggregate: async () => ({}),
  groupBy: async () => [],
};

// Merchant model with Bella's Bakery data
const merchantMockMethods = {
  ...mockMethods,
  findMany: async (args: any) => {
    // Return Bella's Bakery merchant for matching companyId
    if (args?.where?.companyId === "company-bellas-bakery") {
      // Include company with tenant if requested
      if (args?.include?.company) {
        return [{
          ...mockBellasMerchant,
          company: {
            ...mockBellasMerchant.company,
            tenant: {
              id: "tenant-bellas-bakery",
              name: "Bella's Bakery",
              subscriptionPlan: "free",
              subscriptionStatus: "active",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        }];
      }
      return [mockBellasMerchant];
    }
    return [];
  },
  findFirst: async (args: any) => {
    if (
      args?.where?.id === "merchant-bellas-sf" ||
      args?.where?.slug === "bellas-bakery-sf" ||
      args?.where?.companyId === "company-bellas-bakery"
    ) {
      if (args?.include?.company) {
        return {
          ...mockBellasMerchant,
          company: {
            ...mockBellasMerchant.company,
            tenant: {
              id: "tenant-bellas-bakery",
              name: "Bella's Bakery",
              subscriptionPlan: "free",
              subscriptionStatus: "active",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        };
      }
      return mockBellasMerchant;
    }
    return null;
  },
  findUnique: async (args: any) => {
    if (args?.where?.id === "merchant-bellas-sf" || args?.where?.slug === "bellas-bakery-sf") {
      if (args?.include?.company) {
        return {
          ...mockBellasMerchant,
          company: {
            ...mockBellasMerchant.company,
            tenant: {
              id: "tenant-bellas-bakery",
              name: "Bella's Bakery",
              subscriptionPlan: "free",
              subscriptionStatus: "active",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        };
      }
      return mockBellasMerchant;
    }
    return null;
  },
};

// Company model with Bella's Bakery data
const companyMockMethods = {
  ...mockMethods,
  findFirst: async (args: any) => {
    if (
      args?.where?.id === "company-bellas-bakery" ||
      args?.where?.tenantId === "tenant-bellas-bakery"
    ) {
      return mockBellasMerchant.company;
    }
    return null;
  },
  findUnique: async (args: any) => {
    if (args?.where?.id === "company-bellas-bakery") {
      return mockBellasMerchant.company;
    }
    return null;
  },
};

// Order model with proper create response
const orderMockMethods = {
  ...mockMethods,
  create: async (args: any) => ({
    id: `order-${Date.now()}`,
    orderNumber: args?.data?.orderNumber || "ORD-001",
    status: args?.data?.status || "pending",
    ...args?.data,
  }),
};

// Mock prisma instance with PrismaClient type for compatibility
export const prisma = {
  menuCategory: mockMethods,
  menuItem: mockMethods,
  merchant: merchantMockMethods,
  company: companyMockMethods,
  tenant: mockMethods,
  order: orderMockMethods,
  customer: mockMethods,
  user: mockMethods,
  taxConfig: mockMethods,
  merchantTaxRate: mockMethods,
  menuItemTax: mockMethods,
  $connect: async () => {},
  $disconnect: async () => {},
  $transaction: async (fn: any) => fn(prisma),
} as unknown as PrismaClient;

export default prisma;
