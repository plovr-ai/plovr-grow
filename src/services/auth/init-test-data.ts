/**
 * Initialize test data for development
 * Run this once to create test accounts
 */

import { hash } from "bcryptjs";
import {
  mockUserStore,
  mockTenantStore,
  mockCompanyStore,
} from "./mock-store";

const BCRYPT_ROUNDS = 12;

export async function initTestData() {
  // Check if already initialized
  if (mockUserStore.findByEmail("admin@test.com")) {
    console.log("[Test Data] Already initialized");
    return;
  }

  console.log("[Test Data] Initializing test accounts...");

  // Create tenant
  const tenant = mockTenantStore.create("Test Restaurant Group");

  // Create company
  const company = mockCompanyStore.create(
    tenant.id,
    "Test Restaurant Group",
    "Test Restaurant Group LLC"
  );

  // Hash password once
  const passwordHash = await hash("password123", BCRYPT_ROUNDS);

  // Create test users
  const testUsers = [
    {
      email: "admin@test.com",
      name: "Admin User",
      role: "owner",
    },
    {
      email: "manager@test.com",
      name: "Manager User",
      role: "manager",
    },
    {
      email: "staff@test.com",
      name: "Staff User",
      role: "staff",
    },
  ];

  for (const userData of testUsers) {
    mockUserStore.create({
      tenantId: tenant.id,
      companyId: company.id,
      email: userData.email,
      passwordHash,
      name: userData.name,
      role: userData.role,
      status: "active",
      lastLoginAt: null,
    });
    console.log(`[Test Data] Created user: ${userData.email}`);
  }

  console.log("[Test Data] Initialization complete!");
  console.log("\nTest Accounts:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Email: admin@test.com");
  console.log("Password: password123");
  console.log("Role: owner");
  console.log("");
  console.log("Email: manager@test.com");
  console.log("Password: password123");
  console.log("Role: manager");
  console.log("");
  console.log("Email: staff@test.com");
  console.log("Password: password123");
  console.log("Role: staff");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}
