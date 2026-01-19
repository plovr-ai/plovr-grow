"use client";

import { useState, useTransition } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { StepProgress } from "./StepProgress";
import { StepNavigation } from "./StepNavigation";
import { WebsiteStep, MenuStep, OOConfigStep } from "./steps";
import {
  updateOnboardingStepAction,
  completeOnboardingAction,
} from "@/app/(dashboard)/dashboard/(protected)/actions/onboarding";
import { useRouter } from "next/navigation";
import type { OnboardingData, OnboardingStepId } from "@/types/onboarding";
import { ONBOARDING_STEPS } from "@/types/onboarding";

interface OnboardingWizardProps {
  companyId: string;
  initialData: OnboardingData;
}

export function OnboardingWizard({
  companyId,
  initialData,
}: OnboardingWizardProps) {
  const [currentStepId, setCurrentStepId] = useState<OnboardingStepId>(
    initialData.currentStep
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const currentStepConfig = ONBOARDING_STEPS.find(
    (s) => s.id === currentStepId
  )!;
  const currentStepIndex = ONBOARDING_STEPS.findIndex(
    (s) => s.id === currentStepId
  );
  const isLastStep = currentStepIndex === ONBOARDING_STEPS.length - 1;

  const handleNext = async () => {
    startTransition(async () => {
      const result = await updateOnboardingStepAction(
        currentStepId,
        "completed"
      );

      if (result.success) {
        if (isLastStep) {
          // Complete onboarding and redirect
          await completeOnboardingAction();
          router.refresh();
        } else {
          // Move to next step
          const nextStep = ONBOARDING_STEPS[currentStepIndex + 1];
          setCurrentStepId(nextStep.id);
        }
      }
    });
  };

  const handleSkip = async () => {
    startTransition(async () => {
      const result = await updateOnboardingStepAction(currentStepId, "skipped");

      if (result.success) {
        if (isLastStep) {
          // Complete onboarding and redirect
          await completeOnboardingAction();
          router.refresh();
        } else {
          // Move to next step
          const nextStep = ONBOARDING_STEPS[currentStepIndex + 1];
          setCurrentStepId(nextStep.id);
        }
      }
    });
  };

  const handleComplete = async () => {
    startTransition(async () => {
      // Mark current step as completed
      await updateOnboardingStepAction(currentStepId, "completed");
      // Complete entire onboarding
      await completeOnboardingAction();
      router.refresh();
    });
  };

  const renderStep = () => {
    switch (currentStepId) {
      case "website":
        return <WebsiteStep companyId={companyId} />;
      case "menu":
        return <MenuStep companyId={companyId} />;
      case "oo_config":
        return <OOConfigStep companyId={companyId} />;
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Welcome to Plovr!</CardTitle>
          <CardDescription className="text-base">
            Let's get your restaurant online in just a few steps
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* Progress Indicator */}
          <StepProgress
            steps={ONBOARDING_STEPS}
            currentStepId={currentStepId}
            stepsData={initialData.steps}
          />

          {/* Current Step Content */}
          <div className="min-h-[400px]">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">{currentStepConfig.title}</h2>
              <p className="text-gray-600">{currentStepConfig.description}</p>
            </div>

            {renderStep()}
          </div>

          {/* Navigation */}
          <StepNavigation
            onNext={handleNext}
            onSkip={handleSkip}
            onComplete={handleComplete}
            isLastStep={isLastStep}
            isPending={isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
}
