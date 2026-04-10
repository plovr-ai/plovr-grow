import prisma from "@/lib/db";
import { generateEntityId } from "@/lib/id";
import { companyService } from "@/services/company/company.service";
import type { User } from "@prisma/client";

export class AuthService {
  /**
   * Find or create a user from a Stytch OAuth/magic-link callback.
   * Uses Prisma (real database) so the user, tenant, and company persist
   * across requests and are visible to the rest of the application.
   */
  async findOrCreateStytchUser(
    email: string,
    stytchUserId: string
  ): Promise<{ user: User; isNewUser: boolean }> {
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

    // 2. Look up by email across all tenants (existing user, first Stytch login)
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

    // 3. New user — create Tenant + Company + Merchant via unified service
    const emailPrefix = email.split("@")[0];
    const companyName = `${emailPrefix}'s Company`;

    const { tenant, company } =
      await companyService.createTenantWithCompanyAndMerchant({
        companyName,
      });

    // Create User in the newly created tenant
    const user = await prisma.user.create({
      data: {
        id: generateEntityId(),
        tenantId: tenant.id,
        companyId: company.id,
        email,
        stytchUserId,
        name: emailPrefix,
        role: "owner",
        status: "active",
        lastLoginAt: new Date(),
      },
    });

    return { user, isNewUser: true };
  }
}

export const authService = new AuthService();
