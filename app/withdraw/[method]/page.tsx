"use client";

import { useParams, useRouter } from "next/navigation";

import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { isAvailable, type CashflowMethod } from "@/lib/cashflow/methods";
import { UnavailableMethod } from "@/components/cashflow/unavailable-method";

export default function WithdrawMethodScreen() {
  const { method } = useParams<{ method: CashflowMethod }>();
  const router = useRouter();
  const { t } = useI18n();

  if (!isAvailable(method)) {
    return <UnavailableMethod method={method} title={t("cashflow.out.title")} />;
  }

  // Moving stablecoins out is the transfer flow with a wallet address as the
  // destination, so this points there rather than duplicating it.
  return (
    <Screen
      title={t("cashflow.send.title")}
      backLabel={t("common.back")}
      footer={
        <Button variant="black" onClick={() => router.push("/send")}>
          {t("cashflow.send.action")}
        </Button>
      }
    >
      <h2 style={typography.display3} className="mb-4">
        {t("cashflow.out.wallet")}
      </h2>
      <Callout>{t("cashflow.send.hint")}</Callout>
    </Screen>
  );
}
