import prisma from "@/lib/db";
import { generateEntityId } from "@/lib/id";
import { slugify } from "@/services/generator/slug.util";
import type { User } from "@prisma/client";

export class AuthService {
  async findOrCreateStytchUser(
    email: string,
    stytchUserId: string
  ): Promise<{ user: User; isNewUser: boolean }> {
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

    const emailPrefix = email.split("@")[0];
    const companyName = `${emailPrefix}'s Company`;
    const baseSlug = slugify(companyName);

    const existingTenant = await prisma.tenant.findUnique({
      where: { slug: baseSlug },
    });
    const slug = existingTenant
      ? `${baseSlug}-${Date.now()}`
      : baseSlug;

    const tenantId = generateEntityId();
    const userId = generateEntityId();

    const user = await prisma.$transaction(async (tx) => {
      await tx.tenant.create({
        data: {
          id: tenantId,
          name: companyName,
          slug,
        },
      });

      return tx.user.create({
        data: {
          id: userId,
          tenantId,
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
