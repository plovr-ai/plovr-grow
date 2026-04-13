"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import type { OnboardingData } from "@/types/onboarding";
import { countFinishedSteps } from "@/types/onboarding";

interface OnboardingCompletedBarProps {
  data: OnboardingData;
  children: React.ReactNode;
}

export function OnboardingCompletedBar({
  data,
  children,
}: OnboardingCompletedBarProps) {
  const t = useTranslations("onboarding");
  const [expanded, setExpanded] = useState(false);
  const { finished, total, skipped } = countFinishedSteps(data);

  const label =
    skipped > 0
      ? t("completedBarWithSkipped", { finished, total, skipped })
      : t("completedBar", { finished, total });

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 p-4"
      >
        <Check className="h-5 w-5 text-emerald-700" />
        <span className="flex-1 text-left text-sm font-medium text-emerald-800">
          {label}
        </span>
        <span className="text-sm text-emerald-700">{t("expand")}</span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-emerald-700" />
        ) : (
          <ChevronDown className="h-4 w-4 text-emerald-700" />
        )}
      </button>
      {expanded && <div className="border-t border-emerald-200 p-4">{children}</div>}
    </div>
  );
}
