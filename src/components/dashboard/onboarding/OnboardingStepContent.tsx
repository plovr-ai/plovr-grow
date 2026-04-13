"use client";

import { useTranslations } from "next-intl";
import type { OnboardingStepId, OnboardingStepStatus } from "@/types/onboarding";

interface OnboardingStepContentProps {
  stepId: OnboardingStepId;
  status: OnboardingStepStatus;
  children: React.ReactNode;
}

export function OnboardingStepContent({ stepId, status, children }: OnboardingStepContentProps) {
  const t = useTranslations("onboarding");

  if (status === "locked") {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-400">{t("lockedHint")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="mb-4 text-base font-semibold text-gray-900">
        {t(`steps.${stepId}.title`)}
      </h3>
      {children}
    </div>
  );
}
