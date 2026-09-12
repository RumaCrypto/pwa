"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Settings } from "lucide-react";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { StatusCard } from "@/components/ui/status-card";
import { Badge } from "@/components/ui/badge";
import { typography } from "@/constants/typography";
import { useI18n } from "@/lib/i18n/i18n-context";
import { truncateAddress } from "@/lib/format";
import { useUsdcBalance } from "@/hooks/use-usdc-balance";
import { useConverted, useMoney } from "@/lib/money/money-context";
import { fromDecimalString, fromMinor } from "@/lib/money/money";

export default function HomePage() {
  const router = useRouter();
  const { t } = useI18n();
  const { ready, authenticated, user } = usePrivy();
  const address = user?.wallet?.address;
  const { balance, loading: balanceLoading } = useUsdcBalance(address);
  const { displayCurrency, format, formatParts } = useMoney();

  const usdBalance = balance ? fromDecimalString(balance, "USD") : fromMinor(0n, "USD");
  const { money: localBalance, loading: rateLoading } = useConverted(usdBalance);

  useEffect(() => {
    if (ready && !authenticated) router.replace("/onboarding");
  }, [ready, authenticated, router]);

  if (!ready || !authenticated) return null;

  const { symbol, integer, decimal, fraction } = formatParts(localBalance ?? usdBalance);
  const pending = balanceLoading || rateLoading;

  return (
    <Screen>
      <div className="flex items-center justify-between gap-3">
        <Badge className="gap-2 py-1.5 pl-1.5 pr-3">
          <span className="h-5 w-5 rounded-full bg-primary" />
          <span className="font-mono">{address ? truncateAddress(address) : "—"}</span>
        </Badge>

        <div className="flex items-center gap-2">
          <Badge variant="outline">{t("tabs.help")}</Badge>
          <button
            onClick={() => router.push("/settings")}
            aria-label={t("settings")}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border-light bg-white text-text-secondary active:opacity-70"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-8">
        <StatusCard
          label={t("tabs.home.balance")}
          caption={displayCurrency === "USD" ? "USDC" : `USDC · ${format(usdBalance)}`}
        >
          <p style={typography.display1} className={clsx(pending && "opacity-60")}>
            <small className="text-2xl opacity-60">{symbol}</small>
            {integer}
            <small className="text-2xl opacity-60">
              {decimal}
              {fraction}
            </small>
          </p>
        </StatusCard>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="black">{t("menu.deposit.label")}</Button>
          <Button variant="secondary">{t("menu.withdraw.label")}</Button>
        </div>
      </div>
    </Screen>
  );
}
