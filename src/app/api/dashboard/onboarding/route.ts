import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api";
import { auth } from "@/lib/auth";
import { tenantService } from "@/services/tenant/tenant.service";
import type { OnboardingStepId, OnboardingStepStatus } from "@/types/onboarding";
import { ONBOARDING_STEP_ORDER } from "@/types/onboarding";
import { z } from "zod";

// GET: Get onboarding status
export const GET = withApiHandler(async () => {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const result = await tenantService.getOnboardingStatus(
    session.user.tenantId
  );

  return NextResponse.json({ success: true, data: result });
});

const updateSchema = z.object({
  stepId: z.enum(ONBOARDING_STEP_ORDER as [string, ...string[]]),
  status: z.enum(["completed", "skipped"]),
});

// POST: Update a step
export const POST = withApiHandler(async (request: NextRequest) => {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const validation = updateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: "Invalid request", details: validation.error.issues },
      { status: 400 }
    );
  }

  const { stepId, status } = validation.data;

  const result = await tenantService.updateOnboardingStep(
    session.user.tenantId,
    stepId as OnboardingStepId,
    status as OnboardingStepStatus
  );

  return NextResponse.json({
    success: true,
    data: {
      onboardingStatus: result.onboardingStatus,
      onboardingData: result.onboardingData,
    },
  });
});
