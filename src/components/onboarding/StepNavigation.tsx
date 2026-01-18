"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, SkipForward, Check } from "lucide-react";

interface StepNavigationProps {
  onNext: () => void;
  onSkip: () => void;
  onComplete: () => void;
  isLastStep: boolean;
  isPending: boolean;
}

export function StepNavigation({
  onNext,
  onSkip,
  onComplete,
  isLastStep,
  isPending,
}: StepNavigationProps) {
  return (
    <div className="flex items-center justify-between border-t pt-6">
      <Button variant="outline" onClick={onSkip} disabled={isPending}>
        <SkipForward className="mr-2 h-4 w-4" />
        Skip for Now
      </Button>

      <div className="flex gap-3">
        {isLastStep ? (
          <Button onClick={onComplete} disabled={isPending} size="lg">
            <Check className="mr-2 h-4 w-4" />
            Complete Setup
          </Button>
        ) : (
          <Button onClick={onNext} disabled={isPending} size="lg">
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
