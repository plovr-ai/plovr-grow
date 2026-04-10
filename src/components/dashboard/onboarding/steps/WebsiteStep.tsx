"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2 } from "lucide-react";
import { PlaceSearch } from "@/app/(platform)/generator/components/PlaceSearch";
import { useDashboard } from "@/contexts/DashboardContext";

interface WebsiteStepProps {
  status: "pending" | "completed" | "skipped";
}

export function WebsiteStep({ status }: WebsiteStepProps) {
  const t = useTranslations("onboarding.steps.website");
  const { tenant } = useDashboard();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (status === "completed") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-green-700">{t("completedDescription")}</p>
        {tenant.slug && (
          <a
            href={`/${tenant.slug}`}
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

  async function handlePlaceSelect(place: {
    placeId: string;
    name: string;
    address: string;
  }) {
    setError(null);
    setProgress(t("generating"));

    try {
      // Call onboarding-specific API that updates existing Company + Merchant
      // with Google Places data (instead of creating new entities)
      const res = await fetch("/api/dashboard/onboarding/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: place.placeId }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error ?? "Failed to set up website");
        setProgress(null);
        return;
      }

      // Success — refresh to show updated state
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setError("Something went wrong");
      setProgress(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700">{t("pendingWhy")}</p>
      <p className="text-sm text-gray-500">{t("pendingEffect")}</p>

      {progress ? (
        <div className="flex items-center gap-2 text-sm text-theme-primary">
          <Loader2 className="h-4 w-4 animate-spin" />
          {progress}
        </div>
      ) : (
        <PlaceSearch onSelect={handlePlaceSelect} />
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
