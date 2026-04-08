import { NextResponse } from "next/server";
import { getAllPlans } from "@/services/subscription";

// GET: List available subscription plans
export async function GET() {
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
