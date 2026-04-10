"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { useDashboard } from "@/contexts/DashboardContext";

interface GbpStepProps {
  status: "pending" | "completed" | "skipped";
}

export function GbpStep({ status }: GbpStepProps) {
  const t = useTranslations("onboarding.steps.gbp");
  const tOnboarding = useTranslations("onboarding");
  const { merchants } = useDashboard();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const merchantId = merchants[0]?.id;

  if (status === "completed") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-green-700">{t("completedDescription")}</p>
        <button className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
          {t("completedAction")}
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>
    );
  }

  function handleConnect() {
    if (!merchantId) return;
    const returnUrl = `/dashboard?onboarding_step=gbp&action=complete`;
    window.location.href = `/api/integration/gbp/oauth/authorize?merchantId=${merchantId}&returnUrl=${encodeURIComponent(returnUrl)}`;
  }

  async function handleSkip() {
    try {
      const res = await fetch("/api/dashboard/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId: "gbp", status: "skipped" }),
      });

      if (res.ok) {
        startTransition(() => {
          router.refresh();
        });
      }
    } catch {
      // Skip is non-critical, silently fail
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700">{t("pendingWhy")}</p>
      <p className="text-sm text-gray-500">{t("pendingEffect")}</p>
      <div className="flex items-center gap-3">
        <button
          onClick={handleConnect}
          className="inline-flex items-center gap-2 rounded-lg bg-theme-primary px-4 py-2 text-sm font-medium text-theme-primary-foreground hover:bg-theme-primary-hover"
        >
          {t("pendingAction")}
        </button>
        <button
          onClick={handleSkip}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          {tOnboarding("skipButton")}
        </button>
      </div>
    </div>
  );
}
