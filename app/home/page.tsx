"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { typography } from "@/constants/typography";

export default function HomePage() {
  const router = useRouter();
  const { ready, authenticated, user, logout } = usePrivy();

  useEffect(() => {
    if (ready && !authenticated) router.replace("/onboarding");
  }, [ready, authenticated, router]);

  if (!ready || !authenticated) return null;

  return (
    <div className="flex flex-1 flex-col justify-between px-6 pb-8 pt-16">
      <div className="flex flex-1 flex-col justify-center gap-2">
        <p style={typography.body3} className="text-text-secondary">
          Wallet address
        </p>
        <p style={typography.heading4} className="break-all">
          {user?.wallet?.address ?? "No wallet yet"}
        </p>
      </div>
      <Button variant="secondary" onClick={logout}>
        Log out
      </Button>
    </div>
  );
}
