"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlaceSearch } from "./components/PlaceSearch";

interface SelectedPlace {
  placeId: string;
  name: string;
  address: string;
}

export default function GeneratorPage() {
  const router = useRouter();
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!selectedPlace) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/generator/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: selectedPlace.placeId,
          placeName: selectedPlace.name,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error ?? "Failed to start generation");
        return;
      }

      if (data.data.existingSlug) {
        router.push(`/${data.data.existingSlug}`);
      } else if (data.data.generationId) {
        router.push(`/generator/${data.data.generationId}/progress`);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Build Your Restaurant Website
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Search for your restaurant and we&apos;ll create a beautiful website for you in seconds.
        </p>

        <div className="mb-6">
          <PlaceSearch onSelect={setSelectedPlace} />
        </div>

        {selectedPlace && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 text-left">
            <p className="font-semibold text-gray-900">{selectedPlace.name}</p>
            <p className="text-sm text-gray-500">{selectedPlace.address}</p>
          </div>
        )}

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <button
          onClick={handleGenerate}
          disabled={!selectedPlace || loading}
          className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Starting..." : "Generate My Website — Free"}
        </button>
      </div>
    </main>
  );
}
