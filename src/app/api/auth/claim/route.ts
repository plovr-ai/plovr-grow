import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { generateEntityId } from "@/lib/id";
import { AppError } from "@/lib/errors";
import { ErrorCodes } from "@/lib/errors/error-codes";

const claimSchema = z.object({
  tenantId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = claimSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.AUTH_VALIDATION_FAILED }, fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { tenantId, email, name } = parsed.data;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { company: true },
    });

    if (!tenant) {
      throw new AppError(ErrorCodes.CLAIM_TENANT_NOT_FOUND, undefined, 404);
    }

    if (tenant.subscriptionStatus !== "trial") {
      throw new AppError(ErrorCodes.CLAIM_TENANT_NOT_TRIAL, undefined, 400);
    }

    const existingUser = await prisma.user.findFirst({ where: { tenantId, email } });
    if (existingUser) {
      throw new AppError(ErrorCodes.AUTH_EMAIL_EXISTS, undefined, 409);
    }

    await prisma.user.create({
      data: {
        id: generateEntityId(), tenantId,
        companyId: tenantId,
        email, passwordHash: null, name, role: "owner", status: "active",
      },
    });

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionStatus: "active" },
    });

    return NextResponse.json({ success: true, companySlug: tenant.company?.slug }, { status: 200 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, error: { code: error.code } },
        { status: error.statusCode }
      );
    }

    console.error("[Auth] Claim error:", error);
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.CLAIM_FAILED } },
      { status: 500 }
    );
  }
}
