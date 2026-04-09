"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { claimSchema, type ClaimInput } from "@/lib/validations/auth";

interface ClaimModalProps {
  tenantId: string;
  companySlug: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ClaimModal({ tenantId, companySlug, isOpen, onClose }: ClaimModalProps) {
  const router = useRouter();
  const [form, setForm] = useState<ClaimInput>({ name: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ClaimInput, string>>>({});
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleChange = (field: keyof ClaimInput, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    // Client-side validation
    const result = claimSchema.safeParse(form);
    if (!result.success) {
      const errors: Partial<Record<keyof ClaimInput, string>> = {};
      result.error.issues.forEach((err) => {
        const field = err.path[0] as keyof ClaimInput;
        errors[field] = err.message;
      });
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          name: form.name,
          email: form.email,
          password: form.password,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error ?? "Failed to claim website");
        return;
      }

      // Auto sign in
      const signInRes = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (signInRes?.error) {
        // Claim succeeded but sign-in failed — redirect to login
        router.push("/dashboard/login");
        return;
      }

      // Redirect to success page
      router.push(`/claim/success?company=${encodeURIComponent(companySlug)}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-xl font-bold mb-1">Claim Your Restaurant Website</h2>
        <p className="text-gray-600 mb-6 text-sm">
          Create your account to manage your website
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input type="text" required className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-theme-primary focus:border-transparent"
              value={form.name} onChange={(e) => handleChange("name", e.target.value)} disabled={loading} />
            {fieldErrors.name && <p className="text-red-600 text-xs mt-1">{fieldErrors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" required className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-theme-primary focus:border-transparent"
              value={form.email} onChange={(e) => handleChange("email", e.target.value)} disabled={loading} />
            {fieldErrors.email && <p className="text-red-600 text-xs mt-1">{fieldErrors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" required className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-theme-primary focus:border-transparent"
              placeholder="At least 8 characters"
              value={form.password} onChange={(e) => handleChange("password", e.target.value)} disabled={loading} />
            {fieldErrors.password && <p className="text-red-600 text-xs mt-1">{fieldErrors.password}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input type="password" required className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-theme-primary focus:border-transparent"
              value={form.confirmPassword} onChange={(e) => handleChange("confirmPassword", e.target.value)} disabled={loading} />
            {fieldErrors.confirmPassword && <p className="text-red-600 text-xs mt-1">{fieldErrors.confirmPassword}</p>}
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2 bg-theme-primary text-theme-primary-foreground rounded-md hover:bg-theme-primary-hover disabled:opacity-50">
              {loading ? "Creating..." : "Claim Website"}
            </button>
          </div>

          <p className="text-xs text-center text-gray-500">
            Already have an account?{" "}
            <a href="/dashboard/login" className="text-theme-primary hover:underline">Log in</a>
          </p>
        </form>
      </div>
    </div>
  );
}
