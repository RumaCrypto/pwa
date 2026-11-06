"use client";

import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";

import { mainnetClient } from "@/lib/viem";
import { forgetOldNames, readCachedHandle, writeCachedHandle } from "./handle-cache";
import { RUMA_REGISTRAR_ADDRESS, chainReader, lookupHandle } from "./registrar";

/**
 * The signed-in user's username. Shows the cached label at once, then checks
 * the chain in the background and corrects the cache if it disagrees.
 *
 * `checked` turns true only once the chain has answered, so "no username yet"
 * prompts don't flash for someone who has one but whose cache is empty, or
 * whose RPC call failed.
 */
export function useHandle(address: string | undefined) {
  const [handle, setHandle] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       localStorage only exists after mount, and the chain answers later still. */
    setChecked(false);
    if (!address) return setHandle(null);

    forgetOldNames(localStorage);
    setHandle(readCachedHandle(localStorage, address));
    /* eslint-enable react-hooks/set-state-in-effect */

    if (!RUMA_REGISTRAR_ADDRESS) return;
    let cancelled = false;
    lookupHandle(chainReader(mainnetClient, RUMA_REGISTRAR_ADDRESS), address as Address)
      .then((label) => {
        if (cancelled) return;
        writeCachedHandle(localStorage, address, label);
        setHandle(label);
        setChecked(true);
      })
      .catch(() => {
        // RPC trouble: keep showing the cached name rather than blanking it.
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  /** Records a name just claimed, so the header shows it before the next chain check. */
  const remember = useCallback(
    (label: string) => {
      if (!address) return;
      writeCachedHandle(localStorage, address, label);
      setHandle(label);
      setChecked(true);
    },
    [address]
  );

  return { handle, checked, remember };
}
