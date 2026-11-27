"use client";

import { PrivyProvider as BasePrivyProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";
import { baseSepolia } from "viem/chains";
import { colors } from "@/constants/colors";
import { DEFAULT_SETTLEMENT_NETWORK } from "@/constants/blockchain";
import { EnsureEmbeddedWallet } from "./ensure-embedded-wallet";

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
        // Base Sepolia only in dev, for /dev/gas-sponsorship (issue #33).
        supportedChains:
          process.env.NODE_ENV === "production"
            ? [DEFAULT_SETTLEMENT_NETWORK]
            : [DEFAULT_SETTLEMENT_NETWORK, baseSepolia],
        embeddedWallets: {
          ethereum: {
            // Only applies to Privy's own modal; our headless login flows
            // rely on <EnsureEmbeddedWallet /> below instead.
            createOnLogin: "users-without-wallets",
          },
        },
        appearance: {
          theme: "light",
          accentColor: colors.primary as `#${string}`,
          landingHeader: "Log in to Ruma",
        },
      }}
    >
      <EnsureEmbeddedWallet />
      {children}
    </BasePrivyProvider>
  );
}
