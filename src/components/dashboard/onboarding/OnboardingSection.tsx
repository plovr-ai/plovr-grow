"use client";

import { useState, useEffect, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useDashboard } from "@/contexts/DashboardContext";
import type { OnboardingStepId } from "@/types/onboarding";
import { ONBOARDING_STEP_ORDER, isOnboardingComplete, countFinishedSteps } from "@/types/onboarding";
import { OnboardingStepper } from "./OnboardingStepper";
import { OnboardingProgressBar } from "./OnboardingProgressBar";
import { OnboardingStepContent } from "./OnboardingStepContent";
import { OnboardingCompletedBar } from "./OnboardingCompletedBar";
import { WebsiteStep } from "./steps/WebsiteStep";
import { GbpStep } from "./steps/GbpStep";
import { MenuStep } from "./steps/MenuStep";
import { StripeStep } from "./steps/StripeStep";

function getStepContent(stepId: OnboardingStepId, status: "pending" | "completed" | "skipped") {
  switch (stepId) {
    case "website":
      return <WebsiteStep status={status} />;
    case "gbp":
      return <GbpStep status={status} />;
    case "menu":
      return <MenuStep status={status} />;
    case "stripe":
      return <StripeStep status={status} />;
  }
}

export function OnboardingSection() {
  const t = useTranslations("onboarding");
  const { onboarding } = useDashboard();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedStep, setSelectedStep] = useState<OnboardingStepId | null>(null);
  const [, startTransition] = useTransition();

  const data = onboarding.data;

  // Handle OAuth callback — auto-complete the step from URL params
  useEffect(() => {
    const step = searchParams.get("onboarding_step") as OnboardingStepId | null;
    const action = searchParams.get("action");

    if (step && action === "complete" && data) {
      const currentStatus = data.steps[step]?.status;
      if (currentStatus === "pending") {
        fetch("/api/dashboard/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stepId: step, status: "completed" }),
        }).then((res) => {
          if (res.ok) {
            startTransition(() => {
              router.replace("/dashboard");
              router.refresh();
            });
          }
        }).catch(() => {
          // OAuth callback completion failed, user can retry
        });
      }
    }
  }, [searchParams, data, router, startTransition]);

  if (!data) return null;
  if (data.dismissedAt) return null;

  const completed = isOnboardingComplete(data);
  const { finished, total } = countFinishedSteps(data);

  // Determine active step: user selection > first pending step
  const firstPending = ONBOARDING_STEP_ORDER.find(
    (id) => data.steps[id].status === "pending"
  );
  const activeStep = selectedStep ?? firstPending ?? ONBOARDING_STEP_ORDER[0];

  function handleStepClick(stepId: OnboardingStepId) {
    setSelectedStep(stepId);
  }

  const activeStatus = data.steps[activeStep].status;

  if (completed) {
    return (
      <OnboardingCompletedBar data={data}>
        <div className="space-y-4">
          <OnboardingStepper
            steps={data.steps}
            activeStep={activeStep}
            onStepClick={handleStepClick}
          />
          <OnboardingStepContent stepId={activeStep} status={activeStatus}>
            {getStepContent(activeStep, activeStatus as "pending" | "completed" | "skipped")}
          </OnboardingStepContent>
        </div>
      </OnboardingCompletedBar>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{t("title")}</h2>
        <p className="text-sm text-gray-500">{t("subtitle")}</p>
      </div>

      {/* Stepper */}
      <OnboardingStepper
        steps={data.steps}
        activeStep={activeStep}
        onStepClick={handleStepClick}
      />

      {/* Progress bar */}
      <OnboardingProgressBar finished={finished} total={total} />

      {/* Active step content */}
      <OnboardingStepContent stepId={activeStep} status={activeStatus}>
        {activeStatus !== "locked" &&
          getStepContent(activeStep, activeStatus as "pending" | "completed" | "skipped")}
      </OnboardingStepContent>
    </div>
  );
}
