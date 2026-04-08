// ==================== Plan Definitions ====================

export interface PlanDefinition {
  name: string;
  code: string;
  monthlyPrice: number;
  currency: string;
  features: string[];
  stripePriceEnvKey: string;
}

export const PLAN_DEFINITIONS = {
  starter: {
    name: "Starter",
    code: "starter",
    monthlyPrice: 49,
    currency: "USD",
    features: [
      "Online ordering",
      "Menu management",
      "Order management",
      "1 location",
    ],
    stripePriceEnvKey: "STRIPE_STARTER_PRICE_ID",
  },
  pro: {
    name: "Pro",
    code: "pro",
    monthlyPrice: 99,
    currency: "USD",
    features: [
      "Everything in Starter",
      "Loyalty program",
      "Gift cards",
      "Catering",
      "Up to 3 locations",
    ],
    stripePriceEnvKey: "STRIPE_PRO_PRICE_ID",
  },
  enterprise: {
    name: "Enterprise",
    code: "enterprise",
    monthlyPrice: 199,
    currency: "USD",
    features: [
      "Everything in Pro",
      "Analytics & reporting",
      "Priority support",
      "Unlimited locations",
    ],
    stripePriceEnvKey: "STRIPE_ENTERPRISE_PRICE_ID",
  },
} as const satisfies Record<string, PlanDefinition>;

// ==================== Helper Functions ====================

const PLAN_CODES = ["starter", "pro", "enterprise"] as const;

const PLAN_TIER_MAP: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

export function getPlanByCode(code: string): PlanDefinition | undefined {
  if (code in PLAN_DEFINITIONS) {
    return PLAN_DEFINITIONS[code as keyof typeof PLAN_DEFINITIONS];
  }
  return undefined;
}

export function getStripePriceId(planCode: string): string | undefined {
  const plan = getPlanByCode(planCode);
  if (!plan) return undefined;
  return process.env[plan.stripePriceEnvKey] ?? undefined;
}

export function getPlanByStripePriceId(
  stripePriceId: string
): PlanDefinition | undefined {
  for (const code of PLAN_CODES) {
    const plan = PLAN_DEFINITIONS[code];
    const envValue = process.env[plan.stripePriceEnvKey];
    if (envValue === stripePriceId) {
      return plan;
    }
  }
  return undefined;
}

export function getAllPlans(): PlanDefinition[] {
  return PLAN_CODES.map((code) => PLAN_DEFINITIONS[code]);
}

export function getPlanTier(planCode: string): number {
  return PLAN_TIER_MAP[planCode] ?? -1;
}
