/**
 * Mock data store for authentication
 * This will be replaced with Prisma calls once database is ready
 */

export interface MockUser {
  id: string;
  tenantId: string;
  companyId: string | null;
  email: string;
  passwordHash: string;
  name: string;
  role: string;
  status: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockTenant {
  id: string;
  name: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockCompany {
  id: string;
  tenantId: string;
  name: string;
  legalName: string | null;
  status: string;
  onboardingStatus: string;
  onboardingData: unknown | null;
  onboardingCompletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockPasswordResetToken {
  id: string;
  email: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

// In-memory stores
const users = new Map<string, MockUser>();
const tenants = new Map<string, MockTenant>();
const companies = new Map<string, MockCompany>();
const passwordResetTokens = new Map<string, MockPasswordResetToken>();

// ID generator
let idCounter = 0;
function generateId(): string {
  idCounter++;
  return `mock_${Date.now()}_${idCounter}`;
}

// User store operations
export const mockUserStore = {
  findByEmail(email: string): MockUser | undefined {
    for (const user of users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return undefined;
  },

  findById(id: string): MockUser | undefined {
    return users.get(id);
  },

  create(data: Omit<MockUser, "id" | "createdAt" | "updatedAt">): MockUser {
    const now = new Date();
    const user: MockUser = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    users.set(user.id, user);
    return user;
  },

  updateLastLogin(id: string): void {
    const user = users.get(id);
    if (user) {
      user.lastLoginAt = new Date();
      user.updatedAt = new Date();
    }
  },

  updatePassword(id: string, passwordHash: string): void {
    const user = users.get(id);
    if (user) {
      user.passwordHash = passwordHash;
      user.updatedAt = new Date();
    }
  },
};

// Tenant store operations
export const mockTenantStore = {
  create(name: string): MockTenant {
    const now = new Date();
    const tenant: MockTenant = {
      id: generateId(),
      name,
      subscriptionPlan: "free",
      subscriptionStatus: "active",
      createdAt: now,
      updatedAt: now,
    };
    tenants.set(tenant.id, tenant);
    return tenant;
  },

  findById(id: string): MockTenant | undefined {
    return tenants.get(id);
  },
};

// Company store operations
export const mockCompanyStore = {
  create(
    tenantId: string,
    name: string,
    legalName?: string | null,
    onboardingStatus: string = "completed"
  ): MockCompany {
    const now = new Date();
    const company: MockCompany = {
      id: generateId(),
      tenantId,
      name,
      legalName: legalName ?? null,
      status: "active",
      onboardingStatus,
      onboardingData: null,
      onboardingCompletedAt: onboardingStatus === "completed" ? now : null,
      createdAt: now,
      updatedAt: now,
    };
    companies.set(company.id, company);
    return company;
  },

  findById(id: string): MockCompany | undefined {
    return companies.get(id);
  },

  findByTenantId(tenantId: string): MockCompany | undefined {
    for (const company of companies.values()) {
      if (company.tenantId === tenantId) {
        return company;
      }
    }
    return undefined;
  },
};

// Password reset token store operations
export const mockPasswordResetTokenStore = {
  create(email: string, token: string, expiresAt: Date): MockPasswordResetToken {
    const resetToken: MockPasswordResetToken = {
      id: generateId(),
      email,
      token,
      expiresAt,
      createdAt: new Date(),
    };
    passwordResetTokens.set(token, resetToken);
    return resetToken;
  },

  findByToken(token: string): MockPasswordResetToken | undefined {
    return passwordResetTokens.get(token);
  },

  deleteByEmail(email: string): void {
    for (const [token, resetToken] of passwordResetTokens.entries()) {
      if (resetToken.email === email) {
        passwordResetTokens.delete(token);
      }
    }
  },

  deleteByToken(token: string): void {
    passwordResetTokens.delete(token);
  },
};

// Export for clearing stores in tests
export function clearAllStores(): void {
  users.clear();
  tenants.clear();
  companies.clear();
  passwordResetTokens.clear();
  idCounter = 0;
}
