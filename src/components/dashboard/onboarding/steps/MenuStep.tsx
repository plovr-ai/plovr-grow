"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { useDashboard } from "@/contexts/DashboardContext";

interface MenuStepProps {
  status: "pending" | "completed" | "skipped";
}

export function MenuStep({ status }: MenuStepProps) {
  const t = useTranslations("onboarding.steps.menu");
  const { merchants } = useDashboard();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const merchantId = merchants[0]?.id;
  const merchantSlug = merchants[0]?.slug;

  if (status === "completed") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-green-700">{t("completedDescription", { categories: "—", items: "—" })}</p>
        {merchantSlug && (
          <a
            href={`/r/${merchantSlug}/menu`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            {t("completedAction")}
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
    );
  }

  function handleConnect() {
    if (!merchantId) return;
    const returnUrl = `/dashboard?onboarding_step=menu&action=complete`;
    window.location.href = `/api/integration/square/oauth/authorize?merchantId=${merchantId}&returnUrl=${encodeURIComponent(returnUrl)}`;
  }

  async function handleSkip() {
    const res = await fetch("/api/dashboard/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId: "menu", status: "skipped" }),
    });

    if (res.ok) {
      startTransition(() => {
        router.refresh();
      });
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
          {t("noPos")}
        </button>
      </div>
    </div>
  );
}
