"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { ProgressSteps } from "../../components/ProgressSteps";

const STEP_LABELS = [
  "Fetching restaurant information",
  "Grabbing photos and reviews",
  "Building your website",
  "Almost done",
];

function getSteps(apiStatus: string) {
  const statusToStep: Record<string, number> = {
    pending: 0,
    fetching_data: 1,
    building: 2,
    completed: 4,
    failed: -1,
  };
  const currentStep = statusToStep[apiStatus] ?? 0;
  return STEP_LABELS.map((label, i) => ({
    label,
    status: (i < currentStep ? "done" : i === currentStep ? "active" : "pending") as "done" | "active" | "pending",
  }));
}

interface Props {
  params: Promise<{ generationId: string }>;
}

export default function ProgressPage({ params }: Props) {
  const { generationId } = use(params);
  const router = useRouter();
  const [status, setStatus] = useState("pending");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/generator/${generationId}/status`);
      const data = await res.json();
      if (!data.success) return;
      setStatus(data.data.status);
      if (data.data.status === "completed" && data.data.companySlug) {
        router.push(`/${data.data.companySlug}`);
      } else if (data.data.status === "failed") {
        setErrorMessage(data.data.errorMessage ?? "Generation failed");
      }
    } catch {
      // Silently retry on next poll
    }
  }, [generationId, router]);

  useEffect(() => {
    pollStatus();
    const interval = setInterval(pollStatus, 2000);
    return () => clearInterval(interval);
  }, [pollStatus]);

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">
          {status === "failed" ? "Something Went Wrong" : "Generating Your Website"}
        </h1>
        <p className="text-gray-500 mb-8 text-center">
          {status === "failed"
            ? "We couldn't build your website. Please try again."
            : "This usually takes a few seconds..."}
        </p>

        <ProgressSteps steps={getSteps(status)} />

        {status === "failed" && errorMessage && (
          <div className="mt-6 text-center">
            <p className="text-red-600 text-sm mb-4">{errorMessage}</p>
          </div>
        )}
      </div>
    </main>
  );
}
