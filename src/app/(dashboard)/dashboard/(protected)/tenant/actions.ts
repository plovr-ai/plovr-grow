"use server";

import { auth } from "@/lib/auth";
import { tenantService } from "@/services/tenant/tenant.service";
import { revalidatePath } from "next/cache";

interface UpdateTenantSettingsInput {
  currency: string;
  locale: string;
}

export async function updateTenantSettingsAction(input: UpdateTenantSettingsInput) {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return { success: false, error: "Unauthorized" };
  }

  const { tenantId } = session.user;

  try {
    await tenantService.updateTenant(tenantId, {
      currency: input.currency,
      locale: input.locale,
    });

    revalidatePath("/dashboard/tenant");

    return { success: true };
  } catch (error) {
    console.error("Failed to update tenant settings:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update tenant settings",
    };
  }
}
