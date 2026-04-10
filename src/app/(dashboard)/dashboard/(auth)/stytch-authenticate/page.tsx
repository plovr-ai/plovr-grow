"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { useStytch } from "@stytch/nextjs";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ErrorKey = "noToken" | "noSession" | "sessionFailed" | "generic";

export default function StytchAuthenticatePage() {
  const router = useRouter();
  const stytchClient = useStytch();
  const t = useTranslations("auth.authenticate");
  const [errorKey, setErrorKey] = useState<ErrorKey | null>(null);

  useEffect(() => {
    async function authenticate() {
      try {
        // Extract the magic link token from the URL
        const params = new URLSearchParams(window.location.search);
        const token = params.get("token");

        if (!token) {
          setErrorKey("noToken");
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
          setErrorKey("noSession");
          return;
        }

        // Pass session_token to NextAuth; server-side verification happens in the provider
        const result = await signIn("stytch", {
          session_token: response.session_token,
          redirect: false,
        });

        if (result?.error) {
          setErrorKey("sessionFailed");
          return;
        }

        // Revoke the Stytch session — we only need the NextAuth session going forward.
        // This prevents the SDK from attempting background refreshes that would fail.
        await stytchClient.session.revoke();

        router.push("/dashboard");
        router.refresh();
      } catch {
        setErrorKey("generic");
      }
    }

    authenticate();
  }, [stytchClient, router]);

  if (errorKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">
              {t("errorTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">{t(`errors.${errorKey}`)}</p>
            <Link
              href="/dashboard/login"
              className="text-blue-600 hover:underline"
            >
              {t("backToLogin")}
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
          <CardTitle className="text-center">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-gray-600">{t("description")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
