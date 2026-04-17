import { userRepository } from "@/repositories/user.repository";
import { tenantRepository } from "@/repositories/tenant.repository";
import { runInTransaction } from "@/lib/transaction";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCodes } from "@/lib/errors/error-codes";
import { tenantService } from "@/services/tenant/tenant.service";
import type { User } from "@prisma/client";

export interface ClaimTenantInput {
  tenantId: string;
  email: string;
  name: string;
}

export class AuthService {
  async findOrCreateStytchUser(
    email: string,
    stytchUserId: string
  ): Promise<{ user: User; isNewUser: boolean }> {
    const existingByStytch = await userRepository.findByStytchUserId(stytchUserId);
    if (existingByStytch) {
      await userRepository.updateLastLogin(existingByStytch.id);
      return { user: existingByStytch, isNewUser: false };
    }

    const existingByEmail = await userRepository.findByEmailGlobal(email);
    if (existingByEmail) {
      const updated = await userRepository.linkStytch(
        existingByEmail.id,
        stytchUserId
      );
      return { user: updated, isNewUser: false };
    }

    const emailPrefix = email.split("@")[0];
    const companyName = `${emailPrefix}'s Company`;

    const user = await runInTransaction(async (tx) => {
      const { tenant } = await tenantService.createTenantWithMerchant({
        name: companyName,
        source: "signup",
        tx,
      });

      return userRepository.create(
        tenant.id,
        {
          email,
          stytchUserId,
          name: emailPrefix,
          role: "owner",
          status: "active",
          lastLoginAt: new Date(),
        },
        tx
      );
    });

    return { user, isNewUser: true };
  }

  /**
   * Claim ownership of an unclaimed tenant (typically one created via the
   * /generator flow) by attaching an owner User record.
   *
   * Returns the tenant's `slug` so the route can redirect the user to their
   * company page.
   */
  async claimTenant(
    input: ClaimTenantInput
  ): Promise<{ companySlug: string | null }> {
    const tenant = await tenantRepository.getById(input.tenantId);
    if (!tenant) {
      throw new AppError(ErrorCodes.CLAIM_TENANT_NOT_FOUND, undefined, 404);
    }

    const existingUser = await userRepository.findByTenantAndEmail(
      input.tenantId,
      input.email
    );
    if (existingUser) {
      throw new AppError(ErrorCodes.AUTH_EMAIL_EXISTS, undefined, 409);
    }

    await userRepository.create(input.tenantId, {
      email: input.email,
      name: input.name,
      role: "owner",
      status: "active",
      passwordHash: null,
    });

    return { companySlug: tenant.slug };
  }
}

export const authService = new AuthService();
