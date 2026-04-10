import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { generateEntityId } from "@/lib/id";

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
        { success: false, error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { tenantId, email, name } = parsed.data;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { company: true },
    });

    if (!tenant) {
      return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
    }

    if (tenant.subscriptionStatus !== "trial") {
      return NextResponse.json({ success: false, error: "Tenant is not in trial status" }, { status: 400 });
    }

    const existingUser = await prisma.user.findFirst({ where: { tenantId, email } });
    if (existingUser) {
      return NextResponse.json({ success: false, error: "Email already exists" }, { status: 409 });
    }

    await prisma.user.create({
      data: {
        id: generateEntityId(), tenantId,
        companyId: tenant.company?.id,
        email, passwordHash: null, name, role: "owner", status: "active",
      },
    });

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionStatus: "active" },
    });

    return NextResponse.json({ success: true, companySlug: tenant.company?.slug }, { status: 200 });
  } catch (error) {
    console.error("[Auth] Claim error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
