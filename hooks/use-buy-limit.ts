"use client";

import { useEffect, useState } from "react";
import { isAddress, type Address } from "viem";
import type { CurrencyCode as SdkCurrencyCode } from "@p2pdotme/sdk/country";

import { p2pProfile } from "@/lib/send/p2p-profile";
import { fromNumber, type Money } from "@/lib/money/money";

/**
 * The most USDC a single BUY order can be for this user in `currency`, as
 * p2p.me's diamond enforces it. Placing above it reverts with
 * `BuyOrderAmountExceedsLimit`, so the amount screen checks it up front.
 * `limit` stays null while loading or if the read fails.
 */
export function useBuyLimit(address: string | undefined, currency: SdkCurrencyCode | undefined) {
  const [limit, setLimit] = useState<Money | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address || !isAddress(address) || !currency) return;

    let cancelled = false;
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- marks the read as in flight. */
    setLoading(true);
    p2pProfile.getTxLimits({ address: address as Address, currency }).then((result) => {
      if (cancelled) return;
      if (result.isOk()) {
        setLimit(fromNumber(result.value.buyLimit, "USD"));
      } else {
        console.error("Failed to fetch p2p.me buy limit", result.error);
        setLimit(null);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [address, currency]);

  return { limit, loading };
}
