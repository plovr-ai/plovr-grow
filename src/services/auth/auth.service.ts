import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import {
  mockUserStore,
  mockTenantStore,
  mockCompanyStore,
  mockPasswordResetTokenStore,
} from "./mock-store";
import { AppError, ErrorCodes } from "@/lib/errors";
import type { RegisterInput, ResetPasswordInput } from "@/lib/validations/auth";

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
