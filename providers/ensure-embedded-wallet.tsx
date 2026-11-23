"use client";

import { useEffect, useRef, useState } from "react";
import { useCreateWallet, usePrivy } from "@privy-io/react-auth";
import { createEmbeddedWalletEnsurer } from "@/lib/wallet/ensure-embedded-wallet";

/**
 * Creates the embedded wallet for any signed-in user who has none. Mounted
 * once under `PrivyProvider`, so it also repairs accounts that signed up
 * without a wallet the next time they open the app.
 */
export function EnsureEmbeddedWallet() {
  const { ready, authenticated, user } = usePrivy();
  const { createWallet } = useCreateWallet();

  // The ensurer lives for the whole session (it remembers an in-flight
  // creation), so it calls whichever `createWallet` Privy handed us last.
  const createWalletRef = useRef(createWallet);
  useEffect(() => {
    createWalletRef.current = createWallet;
  }, [createWallet]);

  const [ensure] = useState(() =>
    createEmbeddedWalletEnsurer(
      () => createWalletRef.current(),
      (error) => console.error("Embedded wallet creation failed", error)
    )
  );

  useEffect(() => {
    void ensure({ ready, authenticated, user: user ?? null });
  }, [ensure, ready, authenticated, user]);

  return null;
}
