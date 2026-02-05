"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Globe,
  Truck,
  MapPin,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ImportResult } from "@/services/onboarding-agent";

interface AIOnboardingClientProps {
  merchantId: string;
  companyName: string;
}

type ImportStatus = "idle" | "importing" | "success" | "error";

interface SourceUrl {
  website: string;
  doordash: string;
  ubereats: string;
  google: string;
}

const SOURCE_CONFIG = [
  {
    key: "website" as const,
    label: "Your Website",
    placeholder: "https://myrestaurant.com",
    icon: Globe,
    required: false,
    description: "Your restaurant's official website",
  },
  {
    key: "doordash" as const,
    label: "DoorDash",
    placeholder: "https://doordash.com/store/your-restaurant-123",
    icon: Truck,
    required: false,
    description: "Your DoorDash store page (optional)",
  },
  {
    key: "ubereats" as const,
    label: "Uber Eats",
    placeholder: "https://ubereats.com/store/your-restaurant",
    icon: Truck,
    required: false,
    description: "Your Uber Eats store page (optional)",
  },
  {
    key: "google" as const,
    label: "Google Business",
    placeholder: "https://google.com/maps/place/Your+Restaurant",
    icon: MapPin,
    required: false,
    description: "Your Google Business profile (optional)",
  },
];

export function AIOnboardingClient({
  merchantId,
  companyName,
}: AIOnboardingClientProps) {
  const router = useRouter();

  const [urls, setUrls] = useState<SourceUrl>({
    website: "",
    doordash: "",
    ubereats: "",
    google: "",
  });

  const [status, setStatus] = useState<ImportStatus>("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasAtLeastOneUrl = Object.values(urls).some((url) => url.trim() !== "");

  const handleUrlChange = (key: keyof SourceUrl, value: string) => {
    setUrls((prev) => ({ ...prev, [key]: value }));
  };

  const handleImport = async () => {
    if (!hasAtLeastOneUrl) return;

    setStatus("importing");
    setError(null);
    setResult(null);

    try {
      // Build sources array from non-empty URLs
      const sources = [];
      if (urls.website.trim()) {
        sources.push({ type: "website" as const, url: urls.website.trim() });
      }
      if (urls.doordash.trim()) {
        sources.push({ type: "doordash" as const, url: urls.doordash.trim() });
      }
      if (urls.ubereats.trim()) {
        sources.push({ type: "ubereats" as const, url: urls.ubereats.trim() });
      }
      if (urls.google.trim()) {
        sources.push({
          type: "google_business" as const,
          url: urls.google.trim(),
        });
      }

      const response = await fetch(
        `/api/dashboard/${merchantId}/onboarding/import`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sources }),
        }
      );

      const data = await response.json();

      if (data.success) {
        setResult(data.data);
        setStatus("success");
      } else {
        setError(data.error || "Import failed");
        setStatus("error");
        if (data.data) {
          setResult(data.data);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setStatus("error");
    }
  };

  const handleReset = () => {
    setStatus("idle");
    setResult(null);
    setError(null);
  };

  const handleViewMenu = () => {
    router.push("/dashboard/menu");
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500">
          <Sparkles className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">AI Menu Import</h1>
        <p className="mt-2 text-gray-600">
          Import your menu from existing sources. Our AI will extract your menu
          items, prices, and descriptions automatically.
        </p>
      </div>

      {/* Import Form */}
      {status === "idle" && (
        <div className="space-y-4">
          {SOURCE_CONFIG.map((source) => {
            const Icon = source.icon;
            return (
              <div
                key={source.key}
                className="rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Icon className="h-5 w-5 text-gray-500" />
                  <label className="font-medium text-gray-900">
                    {source.label}
                  </label>
                  {!source.required && (
                    <span className="text-xs text-gray-400">(Optional)</span>
                  )}
                </div>
                <Input
                  type="url"
                  placeholder={source.placeholder}
                  value={urls[source.key]}
                  onChange={(e) => handleUrlChange(source.key, e.target.value)}
                  className="w-full"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {source.description}
                </p>
              </div>
            );
          })}

          <div className="pt-4">
            <Button
              onClick={handleImport}
              disabled={!hasAtLeastOneUrl}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Import Menu with AI
            </Button>
            {!hasAtLeastOneUrl && (
              <p className="mt-2 text-center text-sm text-gray-500">
                Enter at least one URL to start importing
              </p>
            )}
          </div>
        </div>
      )}

      {/* Importing State */}
      {status === "importing" && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-purple-500" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            Importing your menu...
          </h3>
          <p className="mt-2 text-gray-600">
            This may take a minute. We're scraping your sources and extracting
            menu data with AI.
          </p>
          <div className="mt-6 space-y-2 text-left">
            {Object.entries(urls)
              .filter(([, url]) => url.trim())
              .map(([key]) => (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                  <span className="text-gray-600">
                    Processing{" "}
                    {SOURCE_CONFIG.find((s) => s.key === key)?.label}...
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Success State */}
      {status === "success" && result && (
        <div className="space-y-4">
          <div className="rounded-lg border border-green-200 bg-green-50 p-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <div className="flex-1">
                <h3 className="font-medium text-green-800">
                  Import Successful!
                </h3>
                <p className="mt-1 text-sm text-green-700">
                  Your menu has been imported to {companyName}.
                </p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border bg-white p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">
                {result.created.categories.length}
              </p>
              <p className="text-sm text-gray-500">Categories</p>
            </div>
            <div className="rounded-lg border bg-white p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">
                {result.created.items.length}
              </p>
              <p className="text-sm text-gray-500">Menu Items</p>
            </div>
            <div className="rounded-lg border bg-white p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">
                {(result.duration / 1000).toFixed(1)}s
              </p>
              <p className="text-sm text-gray-500">Duration</p>
            </div>
          </div>

          {/* Source Results */}
          <div className="rounded-lg border bg-white p-4">
            <h4 className="mb-3 font-medium text-gray-900">Source Results</h4>
            <div className="space-y-2">
              {result.sources.map((source, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    {source.status === "success" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : source.status === "partial" ? (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="capitalize">{source.type.replace("_", " ")}</span>
                  </div>
                  <span className="text-gray-500">
                    {source.extractedItems
                      ? `${source.extractedItems} items`
                      : source.error || "Failed"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <div>
                  <h4 className="font-medium text-yellow-800">Warnings</h4>
                  <ul className="mt-2 space-y-1 text-sm text-yellow-700">
                    {result.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleViewMenu}
              className="flex-1 bg-purple-500 text-white hover:bg-purple-600"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View Menu
            </Button>
            <Button variant="outline" onClick={handleReset} className="flex-1">
              Import Again
            </Button>
          </div>
        </div>
      )}

      {/* Error State */}
      {status === "error" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6">
            <div className="flex items-start gap-3">
              <XCircle className="h-6 w-6 text-red-500" />
              <div className="flex-1">
                <h3 className="font-medium text-red-800">Import Failed</h3>
                <p className="mt-1 text-sm text-red-700">
                  {error || "An error occurred during import."}
                </p>
              </div>
            </div>
          </div>

          {/* Show partial results if available */}
          {result && result.sources.length > 0 && (
            <div className="rounded-lg border bg-white p-4">
              <h4 className="mb-3 font-medium text-gray-900">Source Results</h4>
              <div className="space-y-2">
                {result.sources.map((source, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {source.status === "success" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="capitalize">{source.type.replace("_", " ")}</span>
                    </div>
                    <span className="text-gray-500">
                      {source.error || "Failed"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button onClick={handleReset} className="w-full">
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
