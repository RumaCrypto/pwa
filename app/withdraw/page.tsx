"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";

import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { RadioCard } from "@/components/ui/radio-card";
import { DetailRow } from "@/components/ui/detail-row";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { useUsdcBalance } from "@/hooks/use-usdc-balance";
import { useConverted, useMoney } from "@/lib/money/money-context";
import { fromDecimalString, fromMinor } from "@/lib/money/money";
import {
  OUT_METHODS,
  WITHDRAW_FEE,
  defaultMethod,
  enabledMethods,
  isAdvanced,
  type CashflowMethod,
} from "@/lib/cashflow/methods";

export default function WithdrawScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { format } = useMoney();
  const [method, setMethod] = useState<CashflowMethod>(defaultMethod(OUT_METHODS));
  const methods = enabledMethods(OUT_METHODS);

  const { user } = usePrivy();
  const { balance } = useUsdcBalance(user?.wallet?.address);
  const usdBalance = balance ? fromDecimalString(balance, "USD") : fromMinor(0n, "USD");
  const { money: displayBalance } = useConverted(usdBalance);

  return (
    <Screen
      title={t("cashflow.out.title")}
      backLabel={t("common.back")}
      footer={
        <Button variant="black" onClick={() => router.push(`/withdraw/${method}`)}>
          {t("cashflow.continue")}
        </Button>
      }
    >
      <h2 style={typography.display3} className="mb-6">
        {t("cashflow.out.question")}
      </h2>

      <div role="radiogroup" className="flex flex-col gap-3">
        {methods.map((option) => (
          <RadioCard
            key={option}
            title={t(`cashflow.out.${option}` as "cashflow.out.bank")}
            description={t(`cashflow.out.${option}Hint` as "cashflow.out.bankHint")}
            tag={isAdvanced(option) ? t("cashflow.advanced") : undefined}
            selected={option === method}
            onSelect={() => setMethod(option)}
          />
        ))}
      </div>

      <div className="mt-6 border-t border-border-light pt-2">
        <DetailRow label={t("cashflow.available")} value={format(displayBalance ?? usdBalance)} />
        <DetailRow label={t("cashflow.cost")} value={format(WITHDRAW_FEE)} />
        <DetailRow label={t("cashflow.arrives")} value={t("cashflow.arrivesToday")} />
      </div>
    </Screen>
  );
}
