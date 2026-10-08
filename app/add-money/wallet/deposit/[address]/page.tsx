"use client";

import { useCallback, useEffect, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";

import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { DetailRow } from "@/components/ui/detail-row";
import { StatusCard } from "@/components/ui/status-card";
import { typography } from "@/constants/typography";

import { FLAGS } from "@/lib/flags";
import { useI18n } from "@/lib/i18n/i18n-context";
import { formatDayAndTime } from "@/lib/datetime";
import { findNetwork } from "@/lib/intents/networks";
import { getDeposit, updateDeposit, type IntentDeposit } from "@/lib/intents/deposits";
import { useDepositStatus } from "@/lib/intents/use-deposit-status";

export default function IntentDepositPage() {
  // Checked in a wrapper because notFound() throws and the screen below has hooks.
  if (!FLAGS.multichainDeposits) notFound();
  return <IntentDepositScreen />;
}

/** A malformed link (e.g. a stray "%") would otherwise crash the screen instead of showing "not found". */
function decodeAddress(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function IntentDepositScreen() {
  const router = useRouter();
  const { address: rawAddress } = useParams<{ address: string }>();
  const address = decodeAddress(rawAddress);
  const { t } = useI18n();
  const [deposit, setDeposit] = useState<IntentDeposit | null | undefined>(undefined);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       Deposits are read from localStorage, which only exists after mount. */
    setDeposit(getDeposit(localStorage, address) ?? null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [address]);

  const handleUpdate = useCallback(
    (patch: Partial<IntentDeposit>) => {
      const updated = updateDeposit(localStorage, address, patch);
      if (updated) setDeposit(updated);
    },
    [address]
  );

  const expired = useDepositStatus(deposit, handleUpdate);

  if (deposit === undefined) return null;

  if (deposit === null) {
    return (
      <Screen title={t("intents.networks.title")} backLabel={t("common.back")}>
        <p style={typography.body3} className="text-text-secondary">
          {t("intents.deposit.notFound")}
        </p>
      </Screen>
    );
  }

  if (deposit.phase === "completed") {
    return <DepositReceived deposit={deposit} onDone={() => router.replace("/home")} />;
  }

  return (
    <AwaitingDeposit
      deposit={deposit}
      expired={expired}
      onHome={() => router.replace("/home")}
      onNewAddress={() => router.push(`/add-money/wallet/networks/${deposit.network}`)}
    />
  );
}

function AwaitingDeposit({
  deposit,
  expired,
  onHome,
  onNewAddress,
}: {
  deposit: IntentDeposit;
  expired: boolean;
  onHome: () => void;
  onNewAddress: () => void;
}) {
  const { t, language } = useI18n();
  const network = findNetwork(deposit.network);
  const [copied, setCopied] = useState(false);

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const failed = deposit.phase === "refunded" || deposit.phase === "failed";
  const label = {
    awaiting_deposit: t("intents.deposit.waiting"),
    incomplete: t("intents.deposit.incomplete"),
    processing: t("intents.deposit.processing"),
    refunded: t("intents.deposit.refunded"),
    failed: t("intents.deposit.failed"),
    completed: t("intents.deposit.processing"),
  }[deposit.phase];
  const caption = {
    awaiting_deposit: t("intents.deposit.waitingHint"),
    incomplete: t("intents.deposit.incompleteHint"),
    processing: t("intents.deposit.processingHint"),
    refunded: t("intents.deposit.refundedHint"),
    failed: t("intents.deposit.failedHint"),
    completed: t("intents.deposit.processingHint"),
  }[deposit.phase];
  const params = { asset: deposit.assetSymbol, network: network.name };

  return (
    <Screen
      title={t("intents.deposit.title", params)}
      backLabel={t("common.back")}
      footer={
        expired ? (
          <Button variant="black" onClick={onNewAddress}>
            {t("intents.deposit.newAddress")}
          </Button>
        ) : failed || deposit.phase === "processing" ? (
          <Button variant="secondary" onClick={onHome}>
            {t("intents.done.backHome")}
          </Button>
        ) : (
          <Button variant="black" onClick={() => copy(deposit.depositAddress)}>
            <Copy size={18} />
            {copied ? t("cashflow.receive.copied") : t("cashflow.receive.copy")}
          </Button>
        )
      }
    >
      <StatusCard
        label={expired ? t("intents.deposit.expired") : label}
        caption={expired ? t("intents.deposit.expiredHint") : caption}
        className={failed || expired ? "bg-text-tertiary" : undefined}
      >
        <p style={typography.display4}>
          {deposit.amountInFormatted} {deposit.assetSymbol}
        </p>
      </StatusCard>

      {!failed && !expired && <Callout className="mt-5">{t("intents.deposit.warning", params)}</Callout>}

      {/* An expired address must not look usable: Aurora would refund anything sent to it.
          Failed deposits keep it, since support needs it to trace the funds. */}
      {!expired && (
        <Card className="mt-4 px-5 py-5">
          <p style={typography.body3} className="text-text-tertiary">
            {t("intents.deposit.address")}
          </p>
          <p style={typography.body2} className="mt-2 break-all font-mono">
            {deposit.depositAddress}
          </p>
          {deposit.depositMemo && (
            <>
              <p style={typography.body3} className="mt-4 text-text-tertiary">
                {t("intents.deposit.memo")}
              </p>
              <p style={typography.body2} className="mt-2 break-all font-mono">
                {deposit.depositMemo}
              </p>
            </>
          )}
        </Card>
      )}

      <Card className="mt-4 px-5 py-3">
        <DetailRow label={t("intents.deposit.send")} value={`${deposit.amountInFormatted} ${deposit.assetSymbol}`} />
        <DetailRow label={t("intents.deposit.receive")} value={`${deposit.amountOutFormatted} USDC`} />
        <DetailRow label={t("intents.deposit.expires")} value={formatDayAndTime(deposit.deadline, language)} />
      </Card>
    </Screen>
  );
}

function DepositReceived({ deposit, onDone }: { deposit: IntentDeposit; onDone: () => void }) {
  const { t, language } = useI18n();
  const network = findNetwork(deposit.network);
  const received = deposit.receivedFormatted ?? deposit.amountOutFormatted;

  return (
    <Screen footer={<Button variant="black" onClick={onDone}>{t("intents.done.backHome")}</Button>}>
      <div className="mt-10 flex flex-col items-center text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-white">
          <Check size={36} strokeWidth={3} />
        </span>
        <p style={typography.display3} className="mt-6">
          {t("intents.done.title")}
        </p>
        <p style={typography.body3} className="mt-1 text-text-secondary">
          {t("intents.done.subtitle", { amount: received })}
        </p>
      </div>

      <Card className="mt-8 px-5 py-3">
        <DetailRow label={t("intents.done.sent")} value={`${deposit.amountInFormatted} ${deposit.assetSymbol} · ${network.name}`} />
        <DetailRow label={t("intents.done.received")} value={`${received} USDC`} emphasis />
        <DetailRow label={t("intents.done.date")} value={formatDayAndTime(deposit.completedAt ?? deposit.createdAt, language)} />
        {deposit.destinationTxHash && (
          <DetailRow
            label={t("intents.done.receipt")}
            value={<span className="break-all font-mono text-xs">{deposit.destinationTxHash}</span>}
          />
        )}
      </Card>
    </Screen>
  );
}
