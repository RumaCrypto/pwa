"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

import { requestWithdrawEstimate } from "./api";
import { buildWithdrawQuoteRequest, type WithdrawEstimate } from "./quote";
import type { WithdrawAsset } from "./networks";

const DEBOUNCE_MS = 500;

/**
 * Asks for a dry quote once the form has stopped changing for a moment, and
 * aborts the previous one, so typing an amount does not burn the rate limit
 * or show a price for a stale amount.
 */
export function useWithdrawEstimate(
  input: { asset: WithdrawAsset; recipient: string; amount: bigint; refundTo: `0x${string}` } | null
) {
  const { getAccessToken } = usePrivy();
  // The result is stored with the key of the inputs it answers, so a result for
  // older inputs is never shown or saved for the current ones.
  const [result, setResult] = useState<{ key: string; estimate: WithdrawEstimate | null; error: unknown } | null>(null);

  const assetId = input?.asset.assetId;
  const recipient = input?.recipient;
  const amount = input?.amount.toString();
  const refundTo = input?.refundTo;
  const key = input ? `${assetId}|${recipient}|${amount}|${refundTo}` : null;

  useEffect(() => {
    if (!input || key === null) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const request = buildWithdrawQuoteRequest({ ...input, dry: true, now: new Date() });
        const estimate = await requestWithdrawEstimate(request, await getAccessToken(), controller.signal);
        if (!controller.signal.aborted) setResult({ key, estimate, error: null });
      } catch (err) {
        if (!controller.signal.aborted) setResult({ key, estimate: null, error: err ?? new Error("Unknown error") });
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `input` is rebuilt every render; `key` covers its parts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, getAccessToken]);

  const current = result !== null && result.key === key ? result : null;
  return {
    estimate: current?.estimate ?? null,
    loading: key !== null && current === null,
    error: current?.error ?? null,
  };
}
