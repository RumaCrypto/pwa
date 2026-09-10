"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";

export default function RootGate() {
  const router = useRouter();
  const { ready, authenticated } = usePrivy();

  useEffect(() => {
    if (!ready) return;
    router.replace(authenticated ? "/home" : "/onboarding");
  }, [ready, authenticated, router]);

  return null;
}
