"use client";

import {
  StytchProvider as StytchProviderSDK,
  createStytchUIClient,
} from "@stytch/nextjs";

const stytchClient = createStytchUIClient(
  process.env.NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN || ""
);

export function StytchProvider({ children }: { children: React.ReactNode }) {
  return (
    <StytchProviderSDK stytch={stytchClient}>
      {children}
    </StytchProviderSDK>
  );
}
