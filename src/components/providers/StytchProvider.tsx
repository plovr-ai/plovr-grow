"use client";

import {
  StytchProvider as StytchProviderSDK,
  createStytchUIClient,
} from "@stytch/nextjs";

const publicToken = process.env.NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN;
if (!publicToken && process.env.NODE_ENV === "development") {
  console.warn("Missing NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN — Stytch UI will not work");
}

const stytchClient = createStytchUIClient(publicToken || "");

export function StytchProvider({ children }: { children: React.ReactNode }) {
  return (
    <StytchProviderSDK stytch={stytchClient}>
      {children}
    </StytchProviderSDK>
  );
}
