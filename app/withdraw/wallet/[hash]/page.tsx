"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/status-card";
import { DetailRow } from "@/components/ui/detail-row";
import { Timeline } from "@/components/ui/timeline";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { getTransfer, updateTransfer, waitForTransfer, type WalletTransfer } from "@/lib/withdraw/transfers";

const short = (value: string) => `${value.slice(0, 8)}…${value.slice(-6)}`;

export default function WithdrawTransferTrackingScreen() {
  const router = useRouter();
  const { hash } = useParams<{ hash: `0x${string}` }>();
  const { t } = useI18n();

  const [transfer, setTransfer] = useState<WalletTransfer | null | undefined>(undefined);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       Transfers are read from localStorage, which only exists after mount. */
    setTransfer(getTransfer(hash) ?? null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [hash]);

  const pending = transfer?.status === "sent";

  // Polls for the receipt; safe to mount at any status, e.g. after a reload.
  useEffect(() => {
    if (!pending) return;
    let stopped = false;

    waitForTransfer(hash)
      .then((status) => {
        if (!stopped) setTransfer(updateTransfer(hash, { status }) ?? null);
      })
      // Timeout or RPC error: the outcome is unknown, so stay on "sent" rather than claim a failure.
      .catch(() => {});

    return () => {
      stopped = true;
    };
  }, [pending, hash]);

  if (transfer === undefined) return null;

  if (transfer === null) {
    return (
      <Screen title={t("withdrawFlow.transfer.title")} backLabel={t("common.back")}>
        <p style={typography.body3} className="text-text-secondary">
          {t("withdrawFlow.transfer.notFound")}
        </p>
      </Screen>
    );
  }

  const failed = transfer.status === "failed";
  const confirmed = transfer.status === "confirmed";

  return (
    <Screen
      title={t("withdrawFlow.transfer.title")}
      backLabel={t("common.back")}
      footer={
        <Button variant="secondary" onClick={() => router.replace("/home")}>
          {t("sendFlow.track.backHome")}
        </Button>
      }
    >
      <StatusCard
        label={
          failed
            ? t("withdrawFlow.transfer.failed")
            : confirmed
              ? t("withdrawFlow.transfer.confirmed")
              : t("withdrawFlow.transfer.inProgress")
        }
        progress={failed ? undefined : confirmed ? 1 : 0.5}
        caption={failed ? t("withdrawFlow.transfer.failedHint") : undefined}
        className={failed ? "bg-text-tertiary" : undefined}
      >
        <p style={typography.display4}>
          {transfer.amount}
          <small className="ml-1.5 text-lg opacity-60">USDC</small>
        </p>
      </StatusCard>

      <div className="mt-6">
        <Timeline
          steps={[
            {
              title: t("withdrawFlow.transfer.step.sent"),
              subtitle: t("withdrawFlow.transfer.step.sentHint", { network: transfer.networkName }),
              state: "done",
            },
            {
              title: t("withdrawFlow.transfer.step.confirmed"),
              subtitle: t("withdrawFlow.transfer.step.confirmedHint"),
              state: confirmed ? "done" : failed ? "pending" : "current",
            },
          ]}
        />
      </div>

      <Card className="mt-6 px-5 py-3">
        <DetailRow label={t("withdrawFlow.transfer.to")} value={short(transfer.to)} />
        <DetailRow label={t("cashflow.receive.network")} value={transfer.networkName} />
        <DetailRow label={t("withdrawFlow.transfer.hash")} value={short(transfer.id)} />
      </Card>
    </Screen>
  );
}
