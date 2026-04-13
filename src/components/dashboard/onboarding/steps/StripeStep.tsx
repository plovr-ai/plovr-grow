"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

interface StripeStepProps {
  status: "pending" | "completed" | "skipped";
}

export function StripeStep({ status }: StripeStepProps) {
  const t = useTranslations("onboarding.steps.stripe");
  const tOnboarding = useTranslations("onboarding");
  const router = useRouter();
  const [, startTransition] = useTransition();

  if (status === "completed") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-emerald-800">{t("completedDescription")}</p>
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
        >
          {t("completedAction")}
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  function handleConnect() {
    const returnUrl = encodeURIComponent(
      `/dashboard?onboarding_step=stripe&action=complete`
    );
    window.location.href = `/api/dashboard/stripe-connect/authorize?returnUrl=${returnUrl}`;
  }

  async function handleSkip() {
    try {
      const res = await fetch("/api/dashboard/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId: "stripe", status: "skipped" }),
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
          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
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
