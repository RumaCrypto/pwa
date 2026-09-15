"use client";

import { PrivyProvider as BasePrivyProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";
import { colors } from "@/constants/colors";
import { DEFAULT_SETTLEMENT_NETWORK } from "@/constants/blockchain";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export function PrivyProvider({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) {
    // Fails loudly in dev instead of silently rendering a broken auth flow.
    console.error(
      "NEXT_PUBLIC_PRIVY_APP_ID is not set. Create an app at https://dashboard.privy.io and add it to .env.local."
    );
  }

  return (
    <BasePrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email", "passkey"],
        defaultChain: DEFAULT_SETTLEMENT_NETWORK,
        supportedChains: [DEFAULT_SETTLEMENT_NETWORK],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets", // not useful if we are using custom hook calls
          },
        },
        appearance: {
          theme: "light",
          accentColor: colors.primary as `#${string}`,
          landingHeader: "Log in to Ruma",
        },
      }}
    >
      {children}
    </BasePrivyProvider>
  );
}
