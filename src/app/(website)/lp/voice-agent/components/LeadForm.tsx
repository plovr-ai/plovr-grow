"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PlaceSearch } from "@/app/(website)/generator/components/PlaceSearch";

interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
}

interface FormData {
  // Step 1
  restaurantName: string;
  placeId: string;
  address: string;
  locations: string;
  posSystem: string;
  // Step 2
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  smsConsent: boolean;
}

const LOCATION_OPTIONS = ["1", "2-5", "6-10", "11-25", "26+"];
const POS_OPTIONS = ["Toast", "Square", "Clover", "Aloha", "Revel", "SpotOn", "Lightspeed", "Other", "None"];

interface LeadFormProps {
  redirectPath?: string;
}

export function LeadForm({ redirectPath = "/lp/voice-agent/thank-you" }: LeadFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    restaurantName: "",
    placeId: "",
    address: "",
    locations: "1",
    posSystem: "",
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    smsConsent: false,
  });

  const updateField = <K extends keyof FormData>(
    key: K,
    value: FormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const handlePlaceSelect = (place: PlaceResult) => {
    setFormData((prev) => ({
      ...prev,
      restaurantName: place.name,
      placeId: place.placeId,
      address: place.address,
    }));
    setError(null);
  };

  const handleContinue = () => {
    if (!formData.restaurantName.trim()) {
      setError("Please select a restaurant");
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.email.trim()) {
      setError("Email is required");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email");
      return;
    }
    if (!formData.firstName.trim()) {
      setError("First name is required");
      return;
    }
    if (!formData.phone.trim()) {
      setError("Phone number is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/leads/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          utmSource: searchParams.get("utm_source") ?? undefined,
          utmMedium: searchParams.get("utm_medium") ?? undefined,
          utmCampaign: searchParams.get("utm_campaign") ?? undefined,
          utmTerm: searchParams.get("utm_term") ?? undefined,
          utmContent: searchParams.get("utm_content") ?? undefined,
          lgref: searchParams.get("lgref") ?? undefined,
        }),
      });

      if (!res.ok) {
        throw new Error("Submit failed");
      }

      router.push(redirectPath);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
      {step === 1 ? (
        <div className="flex flex-col gap-6">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Step 1 of 2
          </p>

          {/* Restaurant Name */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">
              Restaurant Name
            </label>
            <PlaceSearch onSelect={handlePlaceSelect} />
            {formData.restaurantName && (
              <p className="mt-1 text-sm text-gray-500">
                {formData.restaurantName}
              </p>
            )}
          </div>

          {/* Locations */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">
              How many locations do you own or manage
            </label>
            <select
              value={formData.locations}
              onChange={(e) => updateField("locations", e.target.value)}
              className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat px-4 py-3 pr-10 text-gray-900 focus:border-[#ffbf00] focus:outline-none focus:ring-1 focus:ring-[#ffbf00]"
            >
              {LOCATION_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* POS System */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">
              What POS system do you currently use?
            </label>
            <select
              value={formData.posSystem}
              onChange={(e) => updateField("posSystem", e.target.value)}
              className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat px-4 py-3 pr-10 text-gray-900 focus:border-[#ffbf00] focus:outline-none focus:ring-1 focus:ring-[#ffbf00]"
            >
              <option value="">Select one...</option>
              {POS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* Continue button */}
          <button
            type="button"
            onClick={handleContinue}
            className="w-full rounded-lg bg-[#ffbf00] px-6 py-4 text-lg font-bold text-white transition-colors hover:bg-[#e6ac00]"
          >
            Continue
          </button>

          {/* Privacy text */}
          <p className="text-xs leading-relaxed text-gray-400">
            By providing us with your information you are consenting to the
            collection and use of your information in accordance with our{" "}
            <Link href="/terms" className="underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setError(null);
              }}
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              &lsaquo; Back
            </button>
            <p className="text-sm font-medium text-gray-500">Step 2 of 2</p>
          </div>

          {/* Email */}
          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => updateField("email", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-[#ffbf00] focus:outline-none focus:ring-1 focus:ring-[#ffbf00]"
          />

          {/* First name + Last name */}
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="First name"
              value={formData.firstName}
              onChange={(e) => updateField("firstName", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-[#ffbf00] focus:outline-none focus:ring-1 focus:ring-[#ffbf00]"
            />
            <input
              type="text"
              placeholder="Last name"
              value={formData.lastName}
              onChange={(e) => updateField("lastName", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-[#ffbf00] focus:outline-none focus:ring-1 focus:ring-[#ffbf00]"
            />
          </div>

          {/* Phone */}
          <div className="flex items-center rounded-lg border border-gray-300 focus-within:border-[#ffbf00] focus-within:ring-1 focus-within:ring-[#ffbf00]">
            <span className="flex items-center gap-2 border-r border-gray-300 px-4 py-3 text-sm text-gray-500">
              🇺🇸 US
            </span>
            <input
              type="tel"
              placeholder="Cellphone number"
              value={formData.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              className="w-full px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none"
            />
          </div>

          {/* SMS consent */}
          <label className="flex items-start gap-3 text-xs leading-relaxed text-gray-400">
            <input
              type="checkbox"
              checked={formData.smsConsent}
              onChange={(e) => updateField("smsConsent", e.target.checked)}
              className="mt-0.5 size-4 rounded border-gray-300"
            />
            I agree to receive automated text messages from Localgrow at the
            phone number provided to help me schedule a demo and evaluate the
            platform. Consent is not required. By signing up, I&apos;ll receive
            approximately 4 messages per month. Message &amp; data rates may
            apply. Reply STOP to unsubscribe or HELP for help.
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* Submit button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-[#ffbf00] px-6 py-4 text-lg font-bold text-white transition-colors hover:bg-[#e6ac00] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Join the wishlist"}
          </button>

          {/* Privacy text */}
          <p className="text-xs leading-relaxed text-gray-400">
            By providing us with your information you are consenting to the
            collection and use of your information in accordance with our{" "}
            <Link href="/terms" className="underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline">
              Privacy Policy
            </Link>
            .
          </p>
        </form>
      )}
    </div>
  );
}
