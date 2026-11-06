"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Check, Copy } from "lucide-react";

import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { QrCode } from "@/components/ui/qr-code";
import { DetailRow } from "@/components/ui/detail-row";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { fullEnsName } from "@/lib/usernames/handle";
import { useHandle } from "@/lib/usernames/use-handle";

export function ReceiveAddress() {
  const { t } = useI18n();
  const { user } = usePrivy();
  const address = user?.wallet?.address;
  const { handle } = useHandle(address);
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
          <div className="mt-5 flex justify-center">
            <QrCode value={address} label={t("cashflow.receive.address")} />
          </div>

          {/* The only place the full name shows: it's what other wallets need to type. */}
          {handle && <EnsNameCard name={fullEnsName(handle)} />}

          <Card className="mt-4 px-5 py-5">
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

function EnsNameCard({ name }: { name: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(name);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-4 flex items-center gap-3 rounded-2xl bg-primary px-5 py-4 text-white">
      <div className="min-w-0 flex-1">
        <p style={typography.body3} className="opacity-70">
          {t("cashflow.receive.ensName")}
        </p>
        <p style={typography.body2} className="mt-1 break-all">
          {name}
        </p>
      </div>
      <button
        onClick={copy}
        aria-label={copied ? t("common.copied") : t("cashflow.receive.copyEnsName")}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 active:opacity-70"
      >
        {copied ? <Check size={18} /> : <Copy size={18} />}
      </button>
    </div>
  );
}
