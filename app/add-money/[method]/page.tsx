"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Copy } from "lucide-react";

import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { DetailRow } from "@/components/ui/detail-row";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { isAvailable, type CashflowMethod } from "@/lib/cashflow/methods";
import { UnavailableMethod } from "@/components/cashflow/unavailable-method";

export default function AddMoneyMethodScreen() {
  const { method } = useParams<{ method: CashflowMethod }>();
  const { t } = useI18n();

  if (!isAvailable(method)) {
    return <UnavailableMethod method={method} title={t("cashflow.add.title")} />;
  }

  return <ReceiveAddress />;
}

function ReceiveAddress() {
  const { t } = useI18n();
  const { user } = usePrivy();
  const address = user?.wallet?.address;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Screen
      title={t("cashflow.receive.title")}
      backLabel={t("common.back")}
      footer={
        address ? (
          <Button variant="black" onClick={copy}>
            <Copy size={18} />
            {copied ? t("cashflow.receive.copied") : t("cashflow.receive.copy")}
          </Button>
        ) : undefined
      }
    >
      {/* Sending on the wrong network loses the funds, so this is a warning, not a hint. */}
      <Callout>{t("cashflow.receive.hint")}</Callout>

      {address ? (
        <>
          <Card className="mt-5 px-5 py-5">
            <p style={typography.body3} className="text-text-tertiary">
              {t("cashflow.receive.address")}
            </p>
            <p style={typography.body2} className="mt-2 break-all font-mono">
              {address}
            </p>
          </Card>

          <Card className="mt-4 px-5 py-3">
            <DetailRow label={t("cashflow.receive.network")} value="Base" />
            <DetailRow label={t("cashflow.receive.asset")} value="USDC" />
          </Card>
        </>
      ) : (
        <p style={typography.body3} className="mt-5 text-text-secondary">
          {t("cashflow.receive.noWallet")}
        </p>
      )}
    </Screen>
  );
}
