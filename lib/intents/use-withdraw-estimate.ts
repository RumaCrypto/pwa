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
  const [state, setState] = useState<{ estimate: WithdrawEstimate | null; loading: boolean; error: unknown }>({
    estimate: null,
    loading: false,
    error: null,
  });

  const assetId = input?.asset.assetId;
  const recipient = input?.recipient;
  const amount = input?.amount.toString();
  const refundTo = input?.refundTo;

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       The estimate follows the form: it resets or starts loading as soon as the inputs change. */
    if (!input) {
      setState({ estimate: null, loading: false, error: null });
      return;
    }
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    /* eslint-enable react-hooks/set-state-in-effect */
    const timer = setTimeout(async () => {
      try {
        const request = buildWithdrawQuoteRequest({ ...input, dry: true, now: new Date() });
        const estimate = await requestWithdrawEstimate(request, await getAccessToken(), controller.signal);
        if (!controller.signal.aborted) setState({ estimate, loading: false, error: null });
      } catch (err) {
        if (!controller.signal.aborted) setState({ estimate: null, loading: false, error: err ?? new Error("Unknown error") });
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `input` is rebuilt every render; its parts are the real dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId, recipient, amount, refundTo, getAccessToken]);

  return state;
}
