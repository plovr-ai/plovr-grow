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

        const tokenType = params.get("stytch_token_type");

        // Dispatch to the appropriate Stytch SDK method based on token type
        let response;
        if (tokenType === "oauth") {
          response = await stytchClient.oauth.authenticate(token, {
            session_duration_minutes: 60,
          });
        } else {
          response = await stytchClient.magicLinks.authenticate(token, {
            session_duration_minutes: 60,
          });
        }

        if (!response.session_token) {
          setError("Authentication failed — no session token");
          return;
        }

        // Pass session_token to NextAuth; server-side verification happens in the provider
        const result = await signIn("stytch", {
          session_token: response.session_token,
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
