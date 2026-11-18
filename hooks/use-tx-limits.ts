"use client";

import { useCallback, useEffect, useState } from "react";
import { isAddress, type Address } from "viem";

import { p2pProfile } from "@/lib/send/p2p-profile";
import { p2pPrices } from "@/lib/money/p2p-prices";
import { sdkCurrencyForCountry } from "@/lib/contacts/contacts";
import { fromNumber, type Money } from "@/lib/money/money";
import { levelForRp, rpFromBuyLimit } from "@/lib/limits/limits";

export interface TxLimits {
  /** Largest single BUY (add money), in USDC. Zero until the user has RP. */
  buy: Money;
  /** Largest single SELL (send/withdraw), in USDC — the amount sold, not its fiat payout. */
  sell: Money;
  /** 0..MAX_LEVEL, from the RP behind `buy`; null if the multiplier could not be read. */
  level: number | null;
}

/**
 * Per-order limits p2p.me's diamond enforces for this user in their country's
 * corridor. Placing above them reverts (`BuyOrderAmountExceedsLimit` and the
 * like), so screens check them up front. `limits` stays null while loading or
 * if the read fails — callers show a placeholder, never a guessed default.
 */
export function useTxLimits(address: string | undefined, country: string | null | undefined) {
  const [limits, setLimits] = useState<TxLimits | null>(null);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!address || !isAddress(address) || !country) return;

    let currency: ReturnType<typeof sdkCurrencyForCountry>;
    try {
      currency = sdkCurrencyForCountry(country);
    } catch (err) {
      console.error(err);
      setLimits(null);
      return;
    }

    setLoading(true);
    const [result, ratio] = await Promise.all([
      p2pProfile.getTxLimits({ address: address as Address, currency }),
      p2pPrices.getReputationPerUsdcLimit({ currency }),
    ]);
    if (result.isOk()) {
      const { buyLimit, sellLimit } = result.value;
      if (ratio.isErr()) console.error("Failed to read p2p.me RP multiplier", ratio.error);
      setLimits({
        buy: fromNumber(buyLimit, "USD"),
        sell: fromNumber(sellLimit, "USD"),
        level: ratio.isOk() ? levelForRp(rpFromBuyLimit(buyLimit, ratio.value.multiplier)) : null,
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
