"use server";

import { auth } from "@/lib/auth";
import { taxConfigService } from "@/services/menu/tax-config.service";
import { revalidatePath } from "next/cache";
import type { RoundingMethod } from "@/services/menu/tax-config.types";

interface CreateTaxConfigInput {
  name: string;
  description?: string;
  roundingMethod: RoundingMethod;
  merchantRates: Array<{ merchantId: string; rate: number }>;
}

interface UpdateTaxConfigInput {
  name?: string;
  description?: string;
  roundingMethod?: RoundingMethod;
  merchantRates?: Array<{ merchantId: string; rate: number }>;
}

export async function createTaxConfigAction(input: CreateTaxConfigInput) {
  const session = await auth();

  if (!session?.user?.tenantId || !session?.user?.companyId) {
    return { success: false, error: "Unauthorized" };
  }

  const { tenantId, companyId } = session.user;

  try {
    const taxConfig = await taxConfigService.createTaxConfig(tenantId, companyId, {
      name: input.name,
      description: input.description,
      roundingMethod: input.roundingMethod,
      merchantRates: input.merchantRates,
    });

    revalidatePath("/dashboard/menu/tax", "page");

    return { success: true, data: taxConfig };
  } catch (error) {
    console.error("Failed to create tax config:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create tax config",
    };
  }
}

export async function updateTaxConfigAction(id: string, input: UpdateTaxConfigInput) {
  const session = await auth();

  if (!session?.user?.tenantId || !session?.user?.companyId) {
    return { success: false, error: "Unauthorized" };
  }

  const { tenantId, companyId } = session.user;

  try {
    await taxConfigService.updateTaxConfig(tenantId, companyId, id, {
      name: input.name,
      description: input.description,
      roundingMethod: input.roundingMethod,
      merchantRates: input.merchantRates,
    });

    revalidatePath("/dashboard/menu/tax", "page");

    return { success: true };
  } catch (error) {
    console.error("Failed to update tax config:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update tax config",
    };
  }
}

export async function deleteTaxConfigAction(id: string) {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return { success: false, error: "Unauthorized" };
  }

  const { tenantId } = session.user;

  try {
    await taxConfigService.deleteTaxConfig(tenantId, id);

    revalidatePath("/dashboard/menu/tax", "page");

    return { success: true };
  } catch (error) {
    console.error("Failed to delete tax config:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete tax config",
    };
  }
}
