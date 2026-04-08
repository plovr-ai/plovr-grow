import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAllPlans } from "@/services/subscription";

// GET: List available subscription plans
export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const plans = getAllPlans();

  return NextResponse.json({
    success: true,
    data: plans.map((plan) => ({
      code: plan.code,
      name: plan.name,
      monthlyPrice: plan.monthlyPrice,
      currency: plan.currency,
      features: plan.features,
    })),
  });
}
