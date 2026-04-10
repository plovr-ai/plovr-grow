"use client";

import { useState, useEffect, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useDashboard } from "@/contexts/DashboardContext";
import type { OnboardingStepId } from "@/types/onboarding";
import { ONBOARDING_STEP_ORDER, isOnboardingComplete } from "@/types/onboarding";
import { OnboardingCard } from "./OnboardingCard";
import { OnboardingCompletedBar } from "./OnboardingCompletedBar";
import { WebsiteStep } from "./steps/WebsiteStep";
import { GbpStep } from "./steps/GbpStep";
import { MenuStep } from "./steps/MenuStep";
import { StripeStep } from "./steps/StripeStep";
import { Globe, MapPin, UtensilsCrossed, CreditCard } from "lucide-react";

const STEP_ICONS: Record<OnboardingStepId, React.ReactNode> = {
  website: <Globe className="h-5 w-5" />,
  gbp: <MapPin className="h-5 w-5" />,
  menu: <UtensilsCrossed className="h-5 w-5" />,
  stripe: <CreditCard className="h-5 w-5" />,
};

export function OnboardingSection() {
  const t = useTranslations("onboarding");
  const { onboarding } = useDashboard();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [expandedStep, setExpandedStep] = useState<OnboardingStepId | null>(null);
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

  const firstPending = ONBOARDING_STEP_ORDER.find(
    (id) => data.steps[id].status === "pending"
  );

  const activeStep = expandedStep ?? firstPending ?? null;

  function handleToggle(stepId: OnboardingStepId) {
    setExpandedStep(activeStep === stepId ? null : stepId);
  }

  const cards = ONBOARDING_STEP_ORDER.map((stepId, index) => {
    const stepStatus = data.steps[stepId].status;
    return (
      <OnboardingCard
        key={stepId}
        stepId={stepId}
        stepNumber={index + 1}
        status={stepStatus}
        icon={STEP_ICONS[stepId]}
        isExpanded={activeStep === stepId}
        onToggle={() => handleToggle(stepId)}
      >
        {stepId === "website" && <WebsiteStep status={stepStatus as "pending" | "completed" | "skipped"} />}
        {stepId === "gbp" && <GbpStep status={stepStatus as "pending" | "completed" | "skipped"} />}
        {stepId === "menu" && <MenuStep status={stepStatus as "pending" | "completed" | "skipped"} />}
        {stepId === "stripe" && <StripeStep status={stepStatus as "pending" | "completed" | "skipped"} />}
      </OnboardingCard>
    );
  });

  if (completed) {
    return (
      <OnboardingCompletedBar data={data}>
        <div className="space-y-3">{cards}</div>
      </OnboardingCompletedBar>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{t("title")}</h2>
        <p className="text-sm text-gray-500">{t("subtitle")}</p>
      </div>
      <div className="space-y-3">{cards}</div>
    </div>
  );
}
