"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { typography } from "@/constants/typography";
import { useI18n } from "@/lib/i18n/i18n-context";
import { truncateAddress } from "@/lib/format";
import { useUsdcBalance } from "@/hooks/use-usdc-balance";

export default function HomePage() {
  const router = useRouter();
  const { t } = useI18n();
  const { ready, authenticated, user } = usePrivy();
  const address = user?.wallet?.address;
  const { balance, loading: balanceLoading } = useUsdcBalance(address);

  useEffect(() => {
    if (ready && !authenticated) router.replace("/onboarding");
  }, [ready, authenticated, router]);

  if (!ready || !authenticated) return null;

  const [whole, cents] = (Number(balance ?? 0)).toFixed(2).split(".");

  return (
    <div className="flex flex-1 flex-col px-6 pb-8 pt-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-full bg-primary-light py-1.5 pl-1.5 pr-3">
          <span className="h-5 w-5 rounded-full bg-primary" />
          <span style={typography.label4} className="font-mono text-primary-dark">
            {address ? truncateAddress(address) : "—"}
          </span>
        </div>
        <button
          style={typography.label4}
          className="rounded-full border border-border-light bg-white px-3 py-1.5 text-text-secondary active:opacity-70"
        >
          {t("tabs.help")}
        </button>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-8">
        <div className="rounded-3xl bg-primary-dark px-6 py-6 text-white">
          <p style={typography.extralight1} className="text-text-lightblue font-extralight">
            {t("tabs.home.balance")}
          </p>
          <p className={clsx("mt-1 flex items-end gap-2", balanceLoading && "opacity-60")}>
            <span style={typography.display1}>
              {whole}
              <small className="text-2xl opacity-60">.{cents}</small>
            </span>
          </p>
          <div style={typography.extralight1} className="text-text-lightblue font-extralight mt-3">USDC · equivale a $0,00</div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="black">{t("menu.deposit.label")}</Button>
          <Button variant="secondary">{t("menu.withdraw.label")}</Button>
        </div>
      </div>
    </div>
  );
}
