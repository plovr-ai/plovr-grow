import prisma from "@/lib/db";
import type { DbClient } from "@/lib/db";
import { generateEntityId } from "@/lib/id";

export interface CreateUserInput {
  email: string;
  name: string;
  role?: string;
  status?: string;
  stytchUserId?: string | null;
  passwordHash?: string | null;
  lastLoginAt?: Date | null;
}

export class UserRepository {
  /**
   * Find user by Stytch user ID (globally unique).
   */
  async findByStytchUserId(stytchUserId: string) {
    return prisma.user.findUnique({
      where: { stytchUserId },
    });
  }

  /**
   * Find a non-deleted user by email across all tenants. Used by the Stytch
   * signup flow to detect an existing account before creating a new tenant.
   */
  async findByEmailGlobal(email: string) {
    return prisma.user.findFirst({
      where: { email, deleted: false },
    });
  }

  /**
   * Find a user scoped to a specific tenant (used by the claim flow).
   */
  async findByTenantAndEmail(tenantId: string, email: string) {
    return prisma.user.findFirst({
      where: { tenantId, email },
    });
  }

  /**
   * Create a user under a tenant. Optionally runs inside an existing
   * transaction.
   */
  async create(tenantId: string, data: CreateUserInput, tx?: DbClient) {
    const db = tx ?? prisma;
    return db.user.create({
      data: {
        id: generateEntityId(),
        tenantId,
        email: data.email,
        name: data.name,
        role: data.role ?? "staff",
        status: data.status ?? "active",
        stytchUserId: data.stytchUserId ?? null,
        passwordHash: data.passwordHash ?? null,
        lastLoginAt: data.lastLoginAt ?? null,
      },
    });
  }

  /**
   * Refresh the lastLoginAt timestamp for a user.
   */
  async updateLastLogin(userId: string, tx?: DbClient) {
    const db = tx ?? prisma;
    return db.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  /**
   * Link an existing user account to a Stytch user (used when a local user
   * signs in for the first time via Stytch).
   */
  async linkStytch(userId: string, stytchUserId: string, tx?: DbClient) {
    const db = tx ?? prisma;
    return db.user.update({
      where: { id: userId },
      data: { stytchUserId, lastLoginAt: new Date() },
    });
  }
}

export const userRepository = new UserRepository();
