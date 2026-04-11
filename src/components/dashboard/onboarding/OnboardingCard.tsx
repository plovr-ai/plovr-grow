"use client";

import { Check, Lock, SkipForward, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import type { OnboardingStepId, OnboardingStepStatus } from "@/types/onboarding";

interface OnboardingCardProps {
  stepId: OnboardingStepId;
  stepNumber: number;
  status: OnboardingStepStatus;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function OnboardingCard({
  stepId,
  stepNumber: _stepNumber,
  status,
  icon,
  isExpanded,
  onToggle,
  children,
}: OnboardingCardProps) {
  const t = useTranslations("onboarding");

  const isLocked = status === "locked";
  const isCompleted = status === "completed";
  const isSkipped = status === "skipped";

  return (
    <div
      className={`rounded-lg border transition-all ${
        isLocked
          ? "border-gray-200 bg-gray-50 opacity-60"
          : isCompleted
            ? "border-green-200 bg-green-50"
            : isSkipped
              ? "border-gray-200 bg-gray-50"
              : "border-theme-primary bg-white shadow-sm"
      }`}
    >
      <button
        onClick={isLocked ? undefined : onToggle}
        disabled={isLocked}
        className={`flex w-full items-center gap-4 p-4 text-left ${
          isLocked ? "cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            isLocked
              ? "bg-gray-200 text-gray-400"
              : isCompleted
                ? "bg-green-500 text-white"
                : isSkipped
                  ? "bg-gray-300 text-white"
                  : "bg-theme-primary text-theme-primary-foreground"
          }`}
        >
          {isLocked ? (
            <Lock className="h-5 w-5" />
          ) : isCompleted ? (
            <Check className="h-5 w-5" />
          ) : isSkipped ? (
            <SkipForward className="h-4 w-4" />
          ) : (
            icon
          )}
        </div>

        <div className="flex-1">
          <h3
            className={`font-semibold ${
              isLocked ? "text-gray-400" : isCompleted ? "text-green-800" : "text-gray-900"
            }`}
          >
            {t(`steps.${stepId}.title`)}
          </h3>
          {isLocked && (
            <p className="text-sm text-gray-400">{t("lockedHint")}</p>
          )}
          {isCompleted && (
            <p className="text-sm font-medium text-green-600">
              {t(`steps.${stepId}.completedHeadline`)}
            </p>
          )}
          {isSkipped && stepId === "menu" && (
            <p className="text-sm text-gray-500">
              {t("steps.menu.skippedDescription")}
            </p>
          )}
        </div>

        {!isLocked && (
          <div className="text-gray-400">
            {isExpanded ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </div>
        )}
      </button>

      {isExpanded && !isLocked && (
        <div className="border-t px-4 pb-4 pt-3">{children}</div>
      )}
    </div>
  );
}
