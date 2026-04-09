"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useStytch } from "@stytch/nextjs";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function StytchAuthenticatePage() {
  const router = useRouter();
  const stytchClient = useStytch();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function authenticate() {
      try {
        // Extract the magic link token from the URL
        const params = new URLSearchParams(window.location.search);
        const token = params.get("token");

        if (!token) {
          setError("Authentication failed — no token in URL");
          return;
        }

        // Stytch SDK authenticates the magic link token
        const response = await stytchClient.magicLinks.authenticate(token, {
          session_duration_minutes: 60,
        });

        if (!response.session_token) {
          setError("Authentication failed — no session token");
          return;
        }

        // Call our callback API to verify + find/create user
        const callbackResponse = await fetch("/api/auth/stytch/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_token: response.session_token }),
        });

        if (!callbackResponse.ok) {
          setError("Authentication failed — callback error");
          return;
        }

        const { user } = await callbackResponse.json();

        // Create NextAuth JWT session via the stytch provider
        const result = await signIn("stytch", {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          companyId: user.companyId,
          redirect: false,
        });

        if (result?.error) {
          setError("Failed to create session");
          return;
        }

        router.push("/dashboard");
        router.refresh();
      } catch {
        setError("Authentication failed. Please try again.");
      }
    }

    authenticate();
  }, [stytchClient, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">
              Authentication Error
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">{error}</p>
            <Link
              href="/dashboard/login"
              className="text-blue-600 hover:underline"
            >
              Back to login
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Authenticating...</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-gray-600">Please wait while we verify your identity.</p>
        </CardContent>
      </Card>
    </div>
  );
}
