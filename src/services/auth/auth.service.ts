import prisma from "@/lib/db";
import { generateEntityId } from "@/lib/id";
import { slugify } from "@/services/generator/slug.util";
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
}

export const authService = new AuthService();
