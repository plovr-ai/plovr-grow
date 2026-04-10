"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { StytchLogin, Products, OAuthProviders } from "@stytch/nextjs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginSkeleton() {
  const t = useTranslations("auth.login");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {t("title")}
          </CardTitle>
          <CardDescription className="text-center">
            {t("loading")}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function LoginContent() {
  const t = useTranslations("auth.login");

  const stytchConfig =
    typeof window !== "undefined"
      ? {
          products: [Products.emailMagicLinks, Products.oauth],
          emailMagicLinksOptions: {
            loginRedirectURL: `${window.location.origin}/dashboard/stytch-authenticate`,
            signupRedirectURL: `${window.location.origin}/dashboard/stytch-authenticate`,
          },
          oauthOptions: {
            providers: [{ type: OAuthProviders.Google }],
            loginRedirectURL: `${window.location.origin}/dashboard/stytch-authenticate`,
            signupRedirectURL: `${window.location.origin}/dashboard/stytch-authenticate`,
          },
        }
      : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {t("title")}
          </CardTitle>
          <CardDescription className="text-center">
            {t("description")}
          </CardDescription>
        </CardHeader>

        {stytchConfig && (
          <CardContent>
            <StytchLogin config={stytchConfig} />
          </CardContent>
        )}
      </Card>
    </div>
  );
}
