"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Loader2, MapPin } from "lucide-react";
import { useDashboard } from "@/contexts/DashboardContext";
import type { GbpLocation } from "@/services/gbp/gbp.types";

type StepState =
  | "pending"
  | "checking"
  | "loading_locations"
  | "select_location"
  | "syncing"
  | "completed"
  | "skipped"
  | "error"
  | "no_locations";

interface GbpStepProps {
  status: "pending" | "completed" | "skipped";
}

export function GbpStep({ status }: GbpStepProps) {
  const t = useTranslations("onboarding.steps.gbp");
  const tOnboarding = useTranslations("onboarding");
  const { merchants } = useDashboard();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const merchantId = merchants[0]?.id;

  const [stepState, setStepState] = useState<StepState>(status);
  const [locations, setLocations] = useState<GbpLocation[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const syncLocation = useCallback(
    async (locationName: string) => {
      if (!merchantId) return;
      setStepState("syncing");
      setErrorMessage(null);

      try {
        const res = await fetch("/api/integration/gbp/locations/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ merchantId, locationName }),
        });

        if (!res.ok) {
          throw new Error("Sync failed");
        }

        setStepState("completed");
        startTransition(() => {
          router.refresh();
        });
      } catch {
        setStepState("error");
        setErrorMessage(t("syncError"));
      }
    },
    [merchantId, router, startTransition, t]
  );

  const fetchLocations = useCallback(async () => {
    if (!merchantId) return;
    setStepState("loading_locations");
    setErrorMessage(null);

    try {
      const res = await fetch(
        `/api/integration/gbp/locations?merchantId=${merchantId}`
      );
      if (!res.ok) {
        throw new Error("Failed to fetch locations");
      }

      const json = await res.json();
      const fetchedLocations: GbpLocation[] = json.data ?? [];

      if (fetchedLocations.length === 0) {
        setStepState("no_locations");
        return;
      }

      if (fetchedLocations.length === 1) {
        // Auto-select the only location
        await syncLocation(fetchedLocations[0].name);
        return;
      }

      setLocations(fetchedLocations);
      setStepState("select_location");
    } catch {
      setStepState("error");
      setErrorMessage(t("syncError"));
    }
  }, [merchantId, syncLocation, t]);

  // After OAuth callback, check if we need to select a location
  useEffect(() => {
    const onboardingStep = searchParams.get("onboarding_step");
    const action = searchParams.get("action");

    if (
      onboardingStep === "gbp" &&
      action === "complete" &&
      status === "pending"
    ) {
      fetchLocations();
    }
  }, [searchParams, status, fetchLocations]);

  if (stepState === "completed" || status === "completed") {
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

  if (
    stepState === "checking" ||
    stepState === "loading_locations" ||
    stepState === "syncing"
  ) {
    const message =
      stepState === "syncing" ? t("syncing") : t("loadingLocations");

    return (
      <div className="flex items-center gap-3 py-2">
        <Loader2 className="h-5 w-5 animate-spin text-theme-primary" />
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    );
  }

  if (stepState === "no_locations") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">{t("noLocations")}</p>
        <button
          onClick={fetchLocations}
          className="inline-flex items-center gap-2 rounded-lg bg-theme-primary px-4 py-2 text-sm font-medium text-theme-primary-foreground hover:bg-theme-primary-hover"
        >
          {t("retryButton")}
        </button>
      </div>
    );
  }

  if (stepState === "select_location") {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">
          {t("selectLocationTitle")}
        </p>
        <p className="text-sm text-gray-500">
          {t("selectLocationDescription")}
        </p>
        <div className="space-y-2">
          {locations.map((location) => (
            <div
              key={location.name}
              className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
            >
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-800">
                  {location.title}
                </span>
              </div>
              <button
                onClick={() => syncLocation(location.name)}
                className="rounded-md bg-theme-primary px-3 py-1.5 text-xs font-medium text-theme-primary-foreground hover:bg-theme-primary-hover"
              >
                {t("selectButton")}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (stepState === "error") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-600">{errorMessage}</p>
        <button
          onClick={fetchLocations}
          className="inline-flex items-center gap-2 rounded-lg bg-theme-primary px-4 py-2 text-sm font-medium text-theme-primary-foreground hover:bg-theme-primary-hover"
        >
          {t("retryButton")}
        </button>
      </div>
    );
  }

  // Default: pending state
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
