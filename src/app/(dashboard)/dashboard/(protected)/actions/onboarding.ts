"use server";

import { auth } from "@/lib/auth";
import { companyService } from "@/services/company/company.service";
import { revalidatePath } from "next/cache";
import type {
  OnboardingStepId,
  OnboardingStepStatus,
} from "@/types/onboarding";

/**
 * Update a specific onboarding step
 */
export async function updateOnboardingStepAction(
  stepId: OnboardingStepId,
  status: OnboardingStepStatus
) {
  const session = await auth();

  if (!session?.user?.companyId) {
    throw new Error("Unauthorized: No company ID in session");
  }

  try {
    await companyService.updateOnboardingStep(
      session.user.companyId,
      stepId,
      status
    );

    // Revalidate the page to show updated state
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Failed to update onboarding step:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update step",
    };
  }
}

/**
 * Complete the entire onboarding process
 */
export async function completeOnboardingAction() {
  const session = await auth();

  if (!session?.user?.companyId) {
    throw new Error("Unauthorized: No company ID in session");
  }

  try {
    await companyService.completeOnboarding(session.user.companyId);

    // Revalidate to trigger redirect
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Failed to complete onboarding:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to complete onboarding",
    };
  }
}

/**
 * Initialize onboarding (called on first access)
 */
export async function initializeOnboardingAction() {
  const session = await auth();

  if (!session?.user?.companyId) {
    throw new Error("Unauthorized: No company ID in session");
  }

  try {
    await companyService.initializeOnboarding(session.user.companyId);

    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Failed to initialize onboarding:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to initialize onboarding",
    };
  }
}
