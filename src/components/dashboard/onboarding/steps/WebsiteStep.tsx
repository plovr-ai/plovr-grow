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
  const { company } = useDashboard();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (status === "completed") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-green-700">{t("completedDescription")}</p>
        {company.slug && (
          <a
            href={`/${company.slug}`}
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
      const createRes = await fetch("/api/generator/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: place.placeId,
          placeName: place.name,
        }),
      });
      const createData = await createRes.json();

      if (!createRes.ok || !createData.success) {
        setError(createData.error ?? "Failed to start generation");
        setProgress(null);
        return;
      }

      if (createData.data.existingSlug) {
        await markStepComplete();
        return;
      }

      const genId = createData.data.generationId;

      const pollInterval = setInterval(async () => {
        const statusRes = await fetch(`/api/generator/${genId}/status`);
        const statusData = await statusRes.json();

        if (statusData.data?.status === "completed") {
          clearInterval(pollInterval);
          await markStepComplete();
        } else if (statusData.data?.status === "failed") {
          clearInterval(pollInterval);
          setError(statusData.data.errorMessage ?? "Generation failed");
          setProgress(null);
        }
      }, 2000);
    } catch {
      setError("Something went wrong");
      setProgress(null);
    }
  }

  async function markStepComplete() {
    const res = await fetch("/api/dashboard/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId: "website", status: "completed" }),
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
