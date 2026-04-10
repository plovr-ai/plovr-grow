import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { tenantService } from "@/services/tenant/tenant.service";
import type { OnboardingStepId, OnboardingStepStatus } from "@/types/onboarding";
import { ONBOARDING_STEP_ORDER } from "@/types/onboarding";
import { z } from "zod";

// GET: Get onboarding status
export async function GET() {
  try {
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
  } catch (error) {
    console.error("[Onboarding Status] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get onboarding status" },
      { status: 500 }
    );
  }
}

const updateSchema = z.object({
  stepId: z.enum(ONBOARDING_STEP_ORDER as [string, ...string[]]),
  status: z.enum(["completed", "skipped"]),
});

// POST: Update a step
export async function POST(request: NextRequest) {
  try {
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
  } catch (error) {
    console.error("[Onboarding Update] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update onboarding step" },
      { status: 500 }
    );
  }
}
