"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TextField } from "@/components/dashboard/Form";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";

export default function RegisterPage() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<RegisterInput>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    companyName: "",
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof RegisterInput, string>>
  >({});

  const handleChange = (field: keyof RegisterInput, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validate
    const result = registerSchema.safeParse(formData);
    if (!result.success) {
      const errors: Partial<Record<keyof RegisterInput, string>> = {};
      result.error.issues.forEach((err) => {
        const field = err.path[0] as keyof RegisterInput;
        errors[field] = err.message;
      });
      setFieldErrors(errors);
      setIsLoading(false);
      return;
    }

    // Register via API
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Registration failed");
      setIsLoading(false);
      return;
    }

    // Auto sign in after registration
    const signInResponse = await signIn("credentials", {
      email: formData.email,
      password: formData.password,
      redirect: false,
    });

    if (signInResponse?.error) {
      // Registration succeeded but sign-in failed, redirect to login
      router.push("/dashboard/login?registered=true");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Create an account
          </CardTitle>
          <CardDescription className="text-center">
            Start managing your restaurant today
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <TextField
              id="name"
              label="Your Name"
              placeholder="John Doe"
              value={formData.name}
              onChange={(value) => handleChange("name", value)}
              disabled={isLoading}
              error={fieldErrors.name}
            />

            <TextField
              id="companyName"
              label="Restaurant/Company Name"
              placeholder="Joe's Pizza"
              value={formData.companyName}
              onChange={(value) => handleChange("companyName", value)}
              disabled={isLoading}
              error={fieldErrors.companyName}
            />

            <TextField
              id="email"
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={(value) => handleChange("email", value)}
              disabled={isLoading}
              error={fieldErrors.email}
            />

            <TextField
              id="password"
              label="Password"
              type="password"
              placeholder="At least 8 characters"
              value={formData.password}
              onChange={(value) => handleChange("password", value)}
              disabled={isLoading}
              error={fieldErrors.password}
              helperText="Must contain uppercase, lowercase, and number"
            />

            <TextField
              id="confirmPassword"
              label="Confirm Password"
              type="password"
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChange={(value) => handleChange("confirmPassword", value)}
              disabled={isLoading}
              error={fieldErrors.confirmPassword}
            />
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating account..." : "Create account"}
            </Button>

            <p className="text-sm text-center text-gray-600">
              Already have an account?{" "}
              <Link
                href="/dashboard/login"
                className="text-blue-600 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
