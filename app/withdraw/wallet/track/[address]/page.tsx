"use client";

import { useCallback, useEffect, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import { Check, Circle, ExternalLink, Loader2 } from "lucide-react";

import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DetailRow } from "@/components/ui/detail-row";
import { StatusCard } from "@/components/ui/status-card";
import { AddressChunks } from "@/components/cashflow/address-chunks";
import { typography } from "@/constants/typography";

import { FLAGS } from "@/lib/flags";
import { useI18n } from "@/lib/i18n/i18n-context";
import { formatDayAndTime } from "@/lib/datetime";
import { findNetwork } from "@/lib/intents/networks";
import { baseTxUrl, explorerTxUrl } from "@/lib/intents/explorers";
import { getWithdrawal, updateWithdrawal, type IntentWithdrawal } from "@/lib/intents/withdrawals";
import { useWithdrawalStatus } from "@/lib/intents/use-withdrawal-status";

export default function WithdrawalTrackPage() {
  if (!FLAGS.multichainDeposits) notFound();
  return <WithdrawalTrack />;
}

function decodeAddress(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function WithdrawalTrack() {
  const router = useRouter();
  const { address: rawAddress } = useParams<{ address: string }>();
  const address = decodeAddress(rawAddress);
  const { t } = useI18n();
  const [withdrawal, setWithdrawal] = useState<IntentWithdrawal | null | undefined>(undefined);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       Withdrawals are read from localStorage, which only exists after mount. */
    setWithdrawal(getWithdrawal(localStorage, address) ?? null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [address]);

  const handleUpdate = useCallback(
    (patch: Partial<IntentWithdrawal>) => {
      const updated = updateWithdrawal(localStorage, address, patch);
      if (updated) setWithdrawal(updated);
    },
    [address]
  );

  // Only reads status; nothing here ever signs or resends (S4).
  useWithdrawalStatus(withdrawal, handleUpdate);

  if (withdrawal === undefined) return null;
  if (withdrawal === null) {
    return (
      <Screen title={t("withdrawFlow.track.title")} backLabel={t("common.back")}>
        <p style={typography.body3} className="text-text-secondary">
          {t("withdrawFlow.track.notFound")}
        </p>
      </Screen>
    );
  }

  const home = () => router.replace("/home");
  if (withdrawal.phase === "completed") return <WithdrawalDone withdrawal={withdrawal} onDone={home} />;
  return <WithdrawalProgress withdrawal={withdrawal} onHome={home} onAgain={() => router.replace(`/withdraw/wallet/networks/${withdrawal.network}`)} />;
}

function Step({ state, label }: { state: "done" | "active" | "todo"; label: string }) {
  const icon =
    state === "done" ? <Check size={18} className="text-success" /> : state === "active" ? <Loader2 size={18} className="animate-spin" /> : <Circle size={18} className="text-text-tertiary" />;
  return (
    <div className="flex items-center gap-3 py-3">
      {icon}
      <span style={typography.body2} className={state === "todo" ? "text-text-secondary" : undefined}>
        {label}
      </span>
    </div>
  );
}

function WithdrawalProgress({ withdrawal, onHome, onAgain }: { withdrawal: IntentWithdrawal; onHome: () => void; onAgain: () => void }) {
  const { t } = useI18n();
  const network = findNetwork(withdrawal.network);
  const params = { asset: withdrawal.assetSymbol, network: network.name };
  const { phase } = withdrawal;

  if (phase === "transfer_failed" || phase === "refunded" || phase === "failed") {
    const copy = {
      transfer_failed: [t("withdrawFlow.track.notSent"), t("withdrawFlow.track.notSentHint")],
      refunded: [t("withdrawFlow.track.refunded"), t("withdrawFlow.track.refundedHint")],
      failed: [t("withdrawFlow.track.failed"), t("withdrawFlow.track.failedHint")],
    }[phase];
    return (
      <Screen
        title={t("withdrawFlow.track.title")}
        backLabel={t("common.back")}
        footer={
          <>
            <Button variant="black" onClick={onAgain}>
              {t("withdrawFlow.track.again")}
            </Button>
            <Button variant="secondary" className="mt-3" onClick={onHome}>
              {t("intents.done.backHome")}
            </Button>
          </>
        }
      >
        <StatusCard label={copy[0]} caption={copy[1]} className="bg-text-tertiary">
          <p style={typography.display4}>{withdrawal.amountInFormatted} USDC</p>
        </StatusCard>
        {phase === "failed" && (
          <Card className="mt-4 px-5 py-4">
            <AddressChunks address={withdrawal.depositAddress} />
          </Card>
        )}
        {withdrawal.transferTxHash && (
          <Card className="mt-4 px-5 py-3">
            <BaseTransferRow hash={withdrawal.transferTxHash} />
          </Card>
        )}
      </Screen>
    );
  }

  const unconfirmed = phase === "awaiting_transfer";
  const converting = phase === "awaiting_deposit" || phase === "incomplete" || phase === "processing";

  return (
    <Screen
      title={t("withdrawFlow.track.title")}
      backLabel={t("common.back")}
      footer={
        <Button variant="secondary" onClick={onHome}>
          {t("intents.done.backHome")}
        </Button>
      }
    >
      <StatusCard
        label={unconfirmed ? t("withdrawFlow.track.unconfirmed") : t("withdrawFlow.track.converting", params)}
        caption={unconfirmed ? t("withdrawFlow.track.unconfirmedHint") : t("withdrawFlow.track.hint")}
      >
        <p style={typography.display4}>
          {withdrawal.amountInFormatted} USDC → ≈ {withdrawal.amountOutFormatted} {withdrawal.assetSymbol}
        </p>
      </StatusCard>

      <Card className="mt-4 divide-y divide-border-light px-5">
        <Step state={unconfirmed ? "active" : "done"} label={t("withdrawFlow.track.sent")} />
        <Step state={converting ? "active" : unconfirmed ? "todo" : "done"} label={t("withdrawFlow.track.converting", params)} />
        <Step state="todo" label={t("withdrawFlow.track.delivered")} />
      </Card>

      {withdrawal.transferTxHash && (
        <Card className="mt-4 px-5 py-3">
          <BaseTransferRow hash={withdrawal.transferTxHash} />
        </Card>
      )}
    </Screen>
  );
}

function WithdrawalDone({ withdrawal, onDone }: { withdrawal: IntentWithdrawal; onDone: () => void }) {
  const { t, language } = useI18n();
  const network = findNetwork(withdrawal.network);
  const received = withdrawal.receivedFormatted ?? withdrawal.amountOutFormatted;
  const explorer = withdrawal.destinationTxHash ? explorerTxUrl(withdrawal.network, withdrawal.destinationTxHash) : null;

  return (
    <Screen footer={<Button variant="black" onClick={onDone}>{t("intents.done.backHome")}</Button>}>
      <div className="mt-10 flex flex-col items-center text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-white">
          <Check size={36} strokeWidth={3} />
        </span>
        <p style={typography.display3} className="mt-6">
          {t("withdrawFlow.done.title")}
        </p>
        <p style={typography.body3} className="mt-1 text-text-secondary">
          {t("withdrawFlow.done.subtitle", { amount: received, asset: withdrawal.assetSymbol, network: network.name })}
        </p>
      </div>

      <Card className="mt-8 px-5 py-3">
        <DetailRow label={t("withdrawFlow.review.send")} value={`${withdrawal.amountInFormatted} USDC · Base`} />
        <DetailRow label={t("intents.done.received")} value={`${received} ${withdrawal.assetSymbol}`} emphasis />
        <DetailRow label={t("intents.done.date")} value={formatDayAndTime(withdrawal.completedAt ?? withdrawal.createdAt, language)} />
        <BaseTransferRow hash={withdrawal.transferTxHash} />
        {explorer && (
          <DetailRow
            label={t("withdrawFlow.done.transaction")}
            value={
              <a href={explorer} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary">
                {t("withdrawFlow.done.view")}
                <ExternalLink size={14} />
              </a>
            }
          />
        )}
      </Card>

      <Card className="mt-4 px-5 py-4">
        <p style={typography.body3} className="mb-2 text-text-tertiary">
          {t("withdrawFlow.review.address")}
        </p>
        <AddressChunks address={withdrawal.recipient} />
      </Card>
    </Screen>
  );
}

/** Links the USDC transfer on Base, the part of a withdrawal the user signed. */
function BaseTransferRow({ hash }: { hash?: string }) {
  const { t } = useI18n();
  const url = hash ? baseTxUrl(hash) : null;
  if (!url) return null;
  return (
    <DetailRow
      label={t("withdrawFlow.track.transfer")}
      value={
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary">
          {t("withdrawFlow.viewOnBasescan")}
          <ExternalLink size={14} />
        </a>
      }
    />
  );
}
