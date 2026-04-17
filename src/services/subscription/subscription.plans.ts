import type { ProductLine } from "./subscription.types";
import { PRODUCT_LINES } from "./subscription.types";

// ==================== Plan Definitions ====================

export interface PlanDefinition {
  name: string;
  code: string;
  monthlyPrice: number;
  currency: string;
  tier: number;
  features: string[];
  stripePriceEnvKey: string;
  recommended?: boolean;
}

export const PLAN_DEFINITIONS: Record<ProductLine, Record<string, PlanDefinition>> = {
  platform: {
    starter: {
      name: "Starter",
      code: "starter",
      monthlyPrice: 49,
      currency: "USD",
      tier: 1,
      features: [
        "Online ordering",
        "Menu management",
        "Order management",
        "1 location",
      ],
      stripePriceEnvKey: "STRIPE_PLATFORM_STARTER_PRICE_ID",
    },
    pro: {
      name: "Pro",
      code: "pro",
      monthlyPrice: 99,
      currency: "USD",
      tier: 2,
      features: [
        "Everything in Starter",
        "Loyalty program",
        "Gift cards",
        "Catering",
        "Up to 3 locations",
      ],
      stripePriceEnvKey: "STRIPE_PLATFORM_PRO_PRICE_ID",
      recommended: true,
    },
    enterprise: {
      name: "Enterprise",
      code: "enterprise",
      monthlyPrice: 199,
      currency: "USD",
      tier: 3,
      features: [
        "Everything in Pro",
        "Analytics & reporting",
        "Priority support",
        "Unlimited locations",
      ],
      stripePriceEnvKey: "STRIPE_PLATFORM_ENTERPRISE_PRICE_ID",
    },
  },
  phone_ai: {},
};

// ==================== Helper Functions ====================

export function getPlanByCode(productLine: ProductLine, code: string): PlanDefinition | undefined {
  const productPlans = PLAN_DEFINITIONS[productLine];
  if (!productPlans) return undefined;
  return productPlans[code];
}

export function getStripePriceId(productLine: ProductLine, planCode: string): string | undefined {
  const plan = getPlanByCode(productLine, planCode);
  if (!plan) return undefined;
  return process.env[plan.stripePriceEnvKey] ?? undefined;
}

export function getPlanByStripePriceId(
  stripePriceId: string
): { productLine: ProductLine; plan: PlanDefinition } | undefined {
  for (const productLine of PRODUCT_LINES) {
    const plans = PLAN_DEFINITIONS[productLine];
    for (const code of Object.keys(plans)) {
      const plan = plans[code];
      const envValue = process.env[plan.stripePriceEnvKey];
      if (envValue === stripePriceId) {
        return { productLine: productLine as ProductLine, plan };
      }
    }
  }
  return undefined;
}

export function getAllPlans(productLine: ProductLine): PlanDefinition[] {
  const plans = PLAN_DEFINITIONS[productLine];
  if (!plans) return [];
  return Object.values(plans);
}

export function getPlanTier(productLine: ProductLine, planCode: string): number {
  if (planCode === "free") return 0;
  const plan = getPlanByCode(productLine, planCode);
  return plan?.tier ?? 0;
}
