"use client";

import { useState } from "react";
import { usePhoneInput } from "@/hooks";

interface CateringPageClientProps {
  merchantSlug: string;
}

interface FormData {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  notes: string;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export function CateringPageClient({ merchantSlug }: CateringPageClientProps) {
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    notes: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const { format: formatPhoneInput } = usePhoneInput();

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneInput(value);
    setFormData((prev) => ({ ...prev, phone: formatted }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/storefront/r/${merchantSlug}/catering`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.fieldErrors) {
          setErrors(result.fieldErrors);
        } else {
          alert(result.error || "Failed to submit. Please try again.");
        }
        return;
      }

      // Success
      setIsSuccess(true);
      setFormData({ firstName: "", lastName: "", phone: "", email: "", notes: "" });
    } catch {
      alert("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
        <p className="text-gray-600 mb-6">
          We&apos;ve received your catering inquiry and will contact you soon.
        </p>
        <button
          onClick={() => setIsSuccess(false)}
          className="text-theme-primary hover:text-theme-primary-hover font-medium"
        >
          Submit Another Inquiry
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-gray-100 p-6"
    >
      <div className="space-y-5">
        {/* Name Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="firstName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="firstName"
              value={formData.firstName}
              onChange={(e) =>
                setFormData({ ...formData, firstName: e.target.value })
              }
              placeholder="John"
              autoComplete="given-name"
              className={`w-full px-4 py-3 rounded-lg border ${
                errors.firstName ? "border-red-500" : "border-gray-300"
              } focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent`}
            />
            {errors.firstName && (
              <p className="mt-1 text-sm text-red-500">{errors.firstName}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="lastName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="lastName"
              value={formData.lastName}
              onChange={(e) =>
                setFormData({ ...formData, lastName: e.target.value })
              }
              placeholder="Doe"
              autoComplete="family-name"
              className={`w-full px-4 py-3 rounded-lg border ${
                errors.lastName ? "border-red-500" : "border-gray-300"
              } focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent`}
            />
            {errors.lastName && (
              <p className="mt-1 text-sm text-red-500">{errors.lastName}</p>
            )}
          </div>
        </div>

        {/* Phone */}
        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Phone <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            id="phone"
            value={formData.phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder="(555) 123-4567"
            className={`w-full px-4 py-3 rounded-lg border ${
              errors.phone ? "border-red-500" : "border-gray-300"
            } focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent`}
          />
          {errors.phone && (
            <p className="mt-1 text-sm text-red-500">{errors.phone}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            placeholder="your@email.com"
            className={`w-full px-4 py-3 rounded-lg border ${
              errors.email ? "border-red-500" : "border-gray-300"
            } focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent`}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-500">{errors.email}</p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label
            htmlFor="notes"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Notes <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            id="notes"
            rows={5}
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
            placeholder="Tell us about your event (date, number of guests, preferences, etc.)"
            className={`w-full px-4 py-3 rounded-lg border ${
              errors.notes ? "border-red-500" : "border-gray-300"
            } focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent resize-none`}
          />
          {errors.notes && (
            <p className="mt-1 text-sm text-red-500">{errors.notes}</p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-foreground py-3 rounded-lg font-semibold transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Submitting..." : "Submit Inquiry"}
        </button>
      </div>
    </form>
  );
}
