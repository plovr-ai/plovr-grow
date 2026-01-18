// Onboarding step status
export type OnboardingStepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

// Onboarding overall status
export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed';

// Step identifiers
export type OnboardingStepId = 'website' | 'menu' | 'oo_config';

// Step metadata
export interface OnboardingStepInfo {
  status: OnboardingStepStatus;
  completedAt: string | null;
  data?: Record<string, unknown>; // Optional step-specific data
}

// Complete onboarding data structure
export interface OnboardingData {
  steps: {
    website: OnboardingStepInfo;
    menu: OnboardingStepInfo;
    oo_config: OnboardingStepInfo;
  };
  currentStep: OnboardingStepId;
  startedAt: string;
}

// Default initial state
export const DEFAULT_ONBOARDING_DATA: OnboardingData = {
  steps: {
    website: { status: 'pending', completedAt: null },
    menu: { status: 'pending', completedAt: null },
    oo_config: { status: 'pending', completedAt: null },
  },
  currentStep: 'website',
  startedAt: new Date().toISOString(),
};

// Step configuration for UI
export interface OnboardingStepConfig {
  id: OnboardingStepId;
  title: string;
  description: string;
  order: number;
}

export const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  {
    id: 'website',
    title: 'Website Build',
    description: 'Set up your restaurant website and branding',
    order: 1,
  },
  {
    id: 'menu',
    title: 'Menu Build',
    description: 'Create your menu categories and items',
    order: 2,
  },
  {
    id: 'oo_config',
    title: 'Online Ordering',
    description: 'Configure online ordering settings',
    order: 3,
  },
];
