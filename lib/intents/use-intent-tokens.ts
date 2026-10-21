"use client";

import { useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

import { fetchTokens } from "./api";
import type { IntentsToken } from "./networks";

/**
 * Aurora's token list, fetched once per screen. getAccessToken is read through
 * a ref: Privy hands out a new function once the first token arrives, and with
 * it in the effect's deps the list was fetched twice and reset the asset the
 * user had just picked.
 */
export function useIntentTokens(): { tokens: IntentsToken[] | null; error: unknown } {
  const { getAccessToken } = usePrivy();
  const tokenRef = useRef(getAccessToken);
  tokenRef.current = getAccessToken;

  const [tokens, setTokens] = useState<IntentsToken[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    tokenRef
      .current()
      .then((token) => fetchTokens(token))
      .then((list) => !cancelled && setTokens(list))
      .catch((err) => !cancelled && setError(err ?? new Error("Unknown error")));
    return () => {
      cancelled = true;
    };
  }, []);

  return { tokens, error };
}
