import { PrismaClient } from "@prisma/client";

/**
 * Mock Prisma Client
 * TODO: Replace with real PrismaClient when database is ready
 *
 * This mock returns empty results for all queries.
 * The real PrismaClient type is used for type compatibility.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

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
  merchant: mockMethods,
  company: mockMethods,
  tenant: mockMethods,
  order: orderMockMethods,
  customer: mockMethods,
  user: mockMethods,
  $connect: async () => {},
  $disconnect: async () => {},
  $transaction: async (fn: any) => fn(prisma),
} as unknown as PrismaClient;

export default prisma;
