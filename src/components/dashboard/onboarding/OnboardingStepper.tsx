"use client";

import { Check, Lock, SkipForward, Globe, MapPin, UtensilsCrossed, CreditCard } from "lucide-react";
import { useTranslations } from "next-intl";
import type { OnboardingStepId, OnboardingStepStatus } from "@/types/onboarding";
import { ONBOARDING_STEP_ORDER } from "@/types/onboarding";

const STEP_ICONS: Record<OnboardingStepId, React.ComponentType<{ className?: string }>> = {
  website: Globe,
  gbp: MapPin,
  menu: UtensilsCrossed,
  stripe: CreditCard,
};

interface OnboardingStepperProps {
  steps: Record<OnboardingStepId, { status: OnboardingStepStatus }>;
  activeStep: OnboardingStepId | null;
  onStepClick: (stepId: OnboardingStepId) => void;
}

export function OnboardingStepper({ steps, activeStep, onStepClick }: OnboardingStepperProps) {
  const t = useTranslations("onboarding");

  return (
    <div className="flex items-start justify-between">
      {ONBOARDING_STEP_ORDER.map((stepId, index) => {
        const status = steps[stepId].status;
        const isActive = activeStep === stepId;
        const isLocked = status === "locked";
        const isCompleted = status === "completed";
        const isSkipped = status === "skipped";
        const Icon = STEP_ICONS[stepId];
        const isLast = index === ONBOARDING_STEP_ORDER.length - 1;

        return (
          <div key={stepId} className="flex flex-1 items-start">
            {/* Step indicator + label */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => !isLocked && onStepClick(stepId)}
                disabled={isLocked}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                  isCompleted
                    ? "border-green-500 bg-green-500 text-white cursor-pointer"
                    : isSkipped
                      ? "border-gray-300 bg-gray-300 text-white cursor-pointer"
                      : isActive
                        ? "border-theme-primary bg-theme-primary text-theme-primary-foreground cursor-pointer"
                        : isLocked
                          ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "border-theme-primary bg-white text-theme-primary cursor-pointer"
                }`}
                aria-label={t(`steps.${stepId}.title`)}
                aria-current={isActive ? "step" : undefined}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : isSkipped ? (
                  <SkipForward className="h-4 w-4" />
                ) : isLocked ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </button>
              <span
                className={`mt-2 text-xs font-medium text-center max-w-[80px] leading-tight ${
                  isCompleted
                    ? "text-green-700"
                    : isActive
                      ? "text-theme-primary-hover"
                      : isLocked
                        ? "text-gray-400"
                        : "text-gray-600"
                }`}
              >
                {t(`steps.${stepId}.title`)}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div className="flex-1 pt-5 px-2">
                <div
                  className={`h-0.5 w-full ${
                    isCompleted || isSkipped ? "bg-green-400" : "bg-gray-200"
                  }`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
