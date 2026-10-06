"use client";

import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { displayNameFor, normalizeUsername, usernameKey } from "./username";

/**
 * The name shown on the home header. It lives only on this device: there is
 * no Ruma profile store yet, and the email covers most users by default.
 */
export function useUsername() {
  const { user } = usePrivy();
  const userId = user?.id;
  const email = user?.email?.address;
  const [username, setUsernameState] = useState<string | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       localStorage only exists after mount. */
    if (!userId) return setUsernameState(null);
    try {
      setUsernameState(normalizeUsername(localStorage.getItem(usernameKey(userId)) ?? ""));
    } catch {
      setUsernameState(null);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [userId]);

  const setUsername = useCallback(
    (text: string) => {
      if (!userId) return;
      const next = normalizeUsername(text);
      try {
        if (next) localStorage.setItem(usernameKey(userId), next);
        else localStorage.removeItem(usernameKey(userId));
      } catch {
        // Private mode or full storage: keep the name for this session only.
      }
      setUsernameState(next);
    },
    [userId]
  );

  return { username, email, displayName: displayNameFor({ username, email }), setUsername };
}
