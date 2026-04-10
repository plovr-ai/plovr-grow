"use server";

import { auth } from "@/lib/auth";
import { tenantService } from "@/services/tenant/tenant.service";
import { revalidatePath } from "next/cache";

interface UpdateCompanySettingsInput {
  currency: string;
  locale: string;
}

export async function updateCompanySettingsAction(input: UpdateCompanySettingsInput) {
  const session = await auth();

  if (!session?.user?.companyId) {
    return { success: false, error: "Unauthorized" };
  }

  const { companyId } = session.user;

  try {
    await tenantService.updateTenant(companyId, {
      currency: input.currency,
      locale: input.locale,
    });

    revalidatePath("/dashboard/company");

    return { success: true };
  } catch (error) {
    console.error("Failed to update company settings:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update company settings",
    };
  }
}
