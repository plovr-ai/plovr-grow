"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2 } from "lucide-react";
import { PlaceSearch } from "@/app/(website)/generator/components/PlaceSearch";
import { useDashboard } from "@/contexts/DashboardContext";

interface SelectedPlace {
  placeId: string;
  name: string;
  address: string;
}

interface WebsiteStepProps {
  status: "pending" | "completed" | "skipped";
}

export function WebsiteStep({ status }: WebsiteStepProps) {
  const t = useTranslations("onboarding.steps.website");
  const { tenant } = useDashboard();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(
    null
  );
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (status === "completed") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-emerald-800">{t("completedDescription")}</p>
        {tenant.slug && (
          <a
            href={`/${tenant.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            {t("completedAction")}
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
    );
  }

  async function handleGenerate() {
    if (!selectedPlace) return;
    setError(null);
    setProgress(t("generating"));
    const place = selectedPlace;

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
        <div className="flex items-center gap-2 text-sm text-gray-900">
          <Loader2 className="h-4 w-4 animate-spin" />
          {progress}
        </div>
      ) : selectedPlace ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="font-semibold text-gray-900">{selectedPlace.name}</p>
            <p className="text-sm text-gray-500">{selectedPlace.address}</p>
            <button
              type="button"
              onClick={() => setSelectedPlace(null)}
              className="mt-1 text-sm text-gray-900 hover:text-gray-700 underline"
            >
              {t("changePlace")}
            </button>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            {t("generateAction")}
          </button>
        </div>
      ) : (
        <PlaceSearch onSelect={setSelectedPlace} />
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
