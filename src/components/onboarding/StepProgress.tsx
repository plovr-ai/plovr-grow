"use client";

import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  OnboardingStepConfig,
  OnboardingStepId,
  OnboardingData,
} from "@/types/onboarding";

interface StepProgressProps {
  steps: OnboardingStepConfig[];
  currentStepId: OnboardingStepId;
  stepsData: OnboardingData["steps"];
}

export function StepProgress({
  steps,
  currentStepId,
  stepsData,
}: StepProgressProps) {
  return (
    <div className="flex items-center justify-between">
      {steps.map((step, index) => {
        const stepData = stepsData[step.id];
        const isCompleted =
          stepData.status === "completed" || stepData.status === "skipped";
        const isCurrent = step.id === currentStepId;
        const isSkipped = stepData.status === "skipped";

        return (
          <div key={step.id} className="flex flex-1 items-center">
            {/* Step Circle */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                  isCompleted && "border-green-500 bg-green-500 text-white",
                  isCurrent &&
                    !isCompleted &&
                    "border-blue-500 bg-blue-50 text-blue-500",
                  !isCurrent &&
                    !isCompleted &&
                    "border-gray-300 bg-white text-gray-400"
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
              </div>

              <div className="mt-2 text-center">
                <p
                  className={cn(
                    "text-sm font-medium",
                    isCurrent && "text-blue-600",
                    isCompleted && "text-green-600",
                    !isCurrent && !isCompleted && "text-gray-500"
                  )}
                >
                  {step.title}
                </p>
                {isSkipped && <p className="text-xs text-gray-400">(Skipped)</p>}
              </div>
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "mx-2 h-0.5 flex-1 transition-all",
                  isCompleted ? "bg-green-500" : "bg-gray-300"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
