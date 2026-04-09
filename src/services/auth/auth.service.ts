import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import {
  mockUserStore,
  mockTenantStore,
  mockCompanyStore,
  mockPasswordResetTokenStore,
} from "./mock-store";
import type { MockUser } from "./mock-store";
import { AppError, ErrorCodes } from "@/lib/errors";
import type { RegisterInput, ResetPasswordInput } from "@/lib/validations/auth";
import prisma from "@/lib/db";
import { generateEntityId } from "@/lib/id";
import { slugify } from "@/services/generator/slug.util";

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_EXPIRY_HOURS = 24;

export class AuthService {
  /**
   * Register a new user with tenant and company
   */
  async register(input: RegisterInput) {
    // Check if email already exists
    const existingUser = mockUserStore.findByEmail(input.email);

    if (existingUser) {
      throw new AppError(ErrorCodes.AUTH_EMAIL_EXISTS, undefined, 409);
    }

    // Hash password
    const passwordHash = await hash(input.password, BCRYPT_ROUNDS);

    // Create tenant
    const tenant = mockTenantStore.create(input.companyName);

    // Create company
    const company = mockCompanyStore.create(tenant.id, input.companyName);

    // Create user with owner role
    const user = mockUserStore.create({
      tenantId: tenant.id,
      companyId: company.id,
      email: input.email,
      passwordHash,
      stytchUserId: null,
      name: input.name,
      role: "owner",
      status: "active",
      lastLoginAt: null,
    });

    return { user, tenant, company };
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string) {
    // Find user
    const user = mockUserStore.findByEmail(email);

    // Always return success to prevent email enumeration
    if (!user || user.status !== "active") {
      return { success: true };
    }

    // Delete any existing tokens for this email
    mockPasswordResetTokenStore.deleteByEmail(email);

    // Generate token
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + RESET_TOKEN_EXPIRY_HOURS);

    // Save token
    mockPasswordResetTokenStore.create(email, token, expiresAt);

    // TODO: Send email (mock for now)
    console.log(`[Password Reset] Token for ${email}: ${token}`);
    console.log(
      `[Password Reset] Reset URL: /dashboard/reset-password?token=${token}`
    );

    return { success: true };
  }

  /**
   * Reset password with token
   */
  async resetPassword(input: ResetPasswordInput) {
    // Find valid token
    const resetToken = mockPasswordResetTokenStore.findByToken(input.token);

    if (!resetToken) {
      throw new AppError(ErrorCodes.AUTH_INVALID_RESET_TOKEN, undefined, 400);
    }

    if (resetToken.expiresAt < new Date()) {
      // Clean up expired token
      mockPasswordResetTokenStore.deleteByToken(input.token);
      throw new AppError(ErrorCodes.AUTH_RESET_TOKEN_EXPIRED, undefined, 400);
    }

    // Find user
    const user = mockUserStore.findByEmail(resetToken.email);

    if (!user || user.status !== "active") {
      throw new AppError(ErrorCodes.AUTH_USER_NOT_FOUND, undefined, 404);
    }

    // Hash new password
    const passwordHash = await hash(input.password, BCRYPT_ROUNDS);

    // Update password
    mockUserStore.updatePassword(user.id, passwordHash);

    // Delete used token
    mockPasswordResetTokenStore.deleteByToken(input.token);

    return { success: true };
  }

  /**
   * Find or create a user from a Stytch OAuth/magic-link callback.
   * Uses Prisma (real database) so the user, tenant, and company persist
   * across requests and are visible to the rest of the application.
   */
  async findOrCreateStytchUser(
    email: string,
    stytchUserId: string
  ): Promise<{ user: MockUser; isNewUser: boolean }> {
    // 1. Look up by stytchUserId first (already linked user)
    const existingByStytch = await prisma.user.findUnique({
      where: { stytchUserId },
    });
    if (existingByStytch) {
      await prisma.user.update({
        where: { id: existingByStytch.id },
        data: { lastLoginAt: new Date() },
      });
      return { user: existingByStytch, isNewUser: false };
    }

    // 2. Look up by email across all tenants (existing password user, first Stytch login)
    const existingByEmail = await prisma.user.findFirst({
      where: { email, deleted: false },
    });
    if (existingByEmail) {
      const updated = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { stytchUserId, lastLoginAt: new Date() },
      });
      return { user: updated, isNewUser: false };
    }

    // 3. New user — create Tenant + Company + User in a single transaction
    const emailPrefix = email.split("@")[0];
    const companyName = `${emailPrefix}'s Company`;
    const baseSlug = slugify(companyName);

    // Ensure unique slug
    const existingCompany = await prisma.company.findUnique({
      where: { slug: baseSlug },
    });
    const slug = existingCompany
      ? `${baseSlug}-${Date.now()}`
      : baseSlug;

    const tenantId = generateEntityId();
    const companyId = generateEntityId();
    const userId = generateEntityId();

    const user = await prisma.$transaction(async (tx) => {
      await tx.tenant.create({
        data: {
          id: tenantId,
          name: companyName,
        },
      });

      await tx.company.create({
        data: {
          id: companyId,
          tenantId,
          slug,
          name: companyName,
        },
      });

      return tx.user.create({
        data: {
          id: userId,
          tenantId,
          companyId,
          email,
          stytchUserId,
          name: emailPrefix,
          role: "owner",
          status: "active",
          lastLoginAt: new Date(),
        },
      });
    });

    return { user, isNewUser: true };
  }

  /**
   * Validate reset token (for UI feedback)
   */
  async validateResetToken(token: string) {
    const resetToken = mockPasswordResetTokenStore.findByToken(token);

    if (!resetToken || resetToken.expiresAt < new Date()) {
      return { valid: false };
    }

    return { valid: true, email: resetToken.email };
  }
}

export const authService = new AuthService();
