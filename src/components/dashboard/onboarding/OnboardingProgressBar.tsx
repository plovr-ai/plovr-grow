"use client";

import { useTranslations } from "next-intl";

interface OnboardingProgressBarProps {
  finished: number;
  total: number;
}

export function OnboardingProgressBar({ finished, total }: OnboardingProgressBarProps) {
  const t = useTranslations("onboarding");
  const percentage = total > 0 ? Math.round((finished / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-theme-primary transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm font-medium text-gray-600 whitespace-nowrap">
        {t("progressLabel", { finished, total })}
      </span>
    </div>
  );
}
