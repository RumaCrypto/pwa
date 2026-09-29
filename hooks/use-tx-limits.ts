"use client";

import { useCallback, useEffect, useState } from "react";
import { isAddress, type Address } from "viem";

import { p2pProfile } from "@/lib/send/p2p-profile";
import { sdkCurrencyForCountry } from "@/lib/contacts/contacts";
import { localCurrencyForCountry } from "@/lib/deposit/quote";
import { fromNumber, type Money } from "@/lib/money/money";

export interface TxLimits {
  /** Largest single BUY (add money), in USDC. Zero until the user has RP. */
  buy: Money;
  /** Largest single SELL (send/withdraw), in the country's local fiat. */
  sell: Money;
}

/**
 * Per-order limits p2p.me's diamond enforces for this user in their country's
 * corridor. Placing above them reverts (`BuyOrderAmountExceedsLimit` and the
 * like), so screens check them up front. `limits` stays null while loading or
 * if the read fails.
 */
export function useTxLimits(address: string | undefined, country: string | null | undefined) {
  const [limits, setLimits] = useState<TxLimits | null>(null);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!address || !isAddress(address) || !country) return;

    setLoading(true);
    const result = await p2pProfile.getTxLimits({
      address: address as Address,
      currency: sdkCurrencyForCountry(country),
    });
    if (result.isOk()) {
      setLimits({
        buy: fromNumber(result.value.buyLimit, "USD"),
        sell: fromNumber(result.value.sellLimit, localCurrencyForCountry(country)),
      });
    } else {
      console.error("Failed to fetch p2p.me tx limits", result.error);
      setLimits(null);
    }
    setLoading(false);
  }, [address, country]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { limits, loading, refetch };
}
