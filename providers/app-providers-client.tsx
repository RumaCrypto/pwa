"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

// Privy touches browser-only globals (Document, window) at module-eval time
// deep in its dependency tree (WalletConnect, ...) — SSR-evaluating it
// throws. The whole app is behind client-side auth anyway, so there's no
// upside to SSR here; load the provider tree client-only instead of chasing
// every offending transitive import.
const AppProviders = dynamic(() => import("./app-providers").then((m) => m.AppProviders), {
  ssr: false,
  loading: () => <div className="min-h-dvh bg-background" />,
});

export function AppProvidersClient({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
