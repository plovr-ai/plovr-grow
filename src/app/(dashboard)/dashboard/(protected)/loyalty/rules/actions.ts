"use server";

import { auth } from "@/lib/auth";
import { loyaltyConfigService } from "@/services/loyalty";
import { revalidatePath } from "next/cache";

interface UpdateLoyaltyConfigInput {
  status: "active" | "inactive";
  pointsPerDollar: number;
}

export async function updateLoyaltyConfigAction(input: UpdateLoyaltyConfigInput) {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return { success: false, error: "Unauthorized" };
  }

  const { tenantId } = session.user;

  try {
    await loyaltyConfigService.upsertLoyaltyConfig(tenantId, {
      status: input.status,
      pointsPerDollar: input.pointsPerDollar,
    });

    revalidatePath("/dashboard/loyalty/rules", "page");

    return { success: true };
  } catch (error) {
    console.error("Failed to update loyalty config:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update loyalty configuration",
    };
  }
}
