// Onboarding step statuses
export type OnboardingStepStatus = "locked" | "pending" | "completed" | "skipped";

// Overall onboarding status (stored in Company.onboardingStatus)
export type OnboardingStatus = "not_started" | "in_progress" | "completed";

// Step identifiers
export type OnboardingStepId = "website" | "gbp" | "menu" | "stripe";

// Per-step state stored in onboardingData JSON
export interface OnboardingStepInfo {
  status: OnboardingStepStatus;
  completedAt?: string;
}

// Complete onboarding data structure (Company.onboardingData JSON)
export interface OnboardingData {
  steps: Record<OnboardingStepId, OnboardingStepInfo>;
  dismissedAt?: string;
}

// Step order for iteration
export const ONBOARDING_STEP_ORDER: OnboardingStepId[] = [
  "website",
  "gbp",
  "menu",
  "stripe",
];

// Steps that depend on website being completed
export const WEBSITE_DEPENDENT_STEPS: OnboardingStepId[] = [
  "gbp",
  "menu",
  "stripe",
];

// Default data for a brand-new user (no website yet)
export const DEFAULT_ONBOARDING_DATA: OnboardingData = {
  steps: {
    website: { status: "pending" },
    gbp: { status: "locked" },
    menu: { status: "locked" },
    stripe: { status: "locked" },
  },
};

// Default data for a claimed user (website already generated)
export const CLAIMED_USER_ONBOARDING_DATA: OnboardingData = {
  steps: {
    website: { status: "completed", completedAt: new Date().toISOString() },
    gbp: { status: "pending" },
    menu: { status: "pending" },
    stripe: { status: "pending" },
  },
};

/**
 * Check if all steps are completed or skipped
 */
export function isOnboardingComplete(data: OnboardingData): boolean {
  return ONBOARDING_STEP_ORDER.every(
    (id) => data.steps[id].status === "completed" || data.steps[id].status === "skipped"
  );
}

/**
 * Count completed + skipped steps
 */
export function countFinishedSteps(data: OnboardingData): {
  finished: number;
  total: number;
  skipped: number;
} {
  let finished = 0;
  let skipped = 0;
  for (const id of ONBOARDING_STEP_ORDER) {
    const s = data.steps[id].status;
    if (s === "completed" || s === "skipped") finished++;
    if (s === "skipped") skipped++;
  }
  return { finished, total: ONBOARDING_STEP_ORDER.length, skipped };
}
