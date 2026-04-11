"use server";

import { auth } from "@/lib/auth";
import { merchantService } from "@/services/merchant";
import { revalidatePath } from "next/cache";
import type { UpdateMerchantInput } from "@/services/merchant/merchant.types";

export async function updateLocationAction(
  merchantId: string,
  input: UpdateMerchantInput
) {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return { success: false, error: "Unauthorized" };
  }

  const { tenantId } = session.user;

  try {
    await merchantService.updateMerchant(tenantId, merchantId, input);

    revalidatePath(`/dashboard/locations/${merchantId}`);
    revalidatePath("/dashboard/tenant");

    return { success: true };
  } catch (error) {
    console.error("Failed to update location:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update location",
    };
  }
}
