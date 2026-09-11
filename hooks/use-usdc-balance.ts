"use client";

import { useCallback, useEffect, useState } from "react";
import { formatUnits, isAddress, type Address } from "viem";
import { baseClient } from "@/lib/viem";
import { USDC_ADDRESS_BASE, USDC_DECIMALS, erc20BalanceOfAbi } from "@/lib/usdc";

export function useUsdcBalance(address: string | undefined) {
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!address || !isAddress(address)) return;

    setLoading(true);
    try {
      const raw = await baseClient.readContract({
        address: USDC_ADDRESS_BASE,
        abi: erc20BalanceOfAbi,
        functionName: "balanceOf",
        args: [address as Address],
      });
      setBalance(formatUnits(raw, USDC_DECIMALS));
    } catch (err) {
      console.error("Failed to fetch USDC balance on Base", err);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { balance, loading, refetch };
}
