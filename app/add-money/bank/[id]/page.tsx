"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";

import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/status-card";
import { DetailRow } from "@/components/ui/detail-row";
import { Timeline } from "@/components/ui/timeline";
import { Callout } from "@/components/ui/callout";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { countryName, formatLocalPayoutReference, localPayoutLabel } from "@/lib/contacts/contacts";
import { useMoney } from "@/lib/money/money-context";
import { useDeposit } from "@/lib/deposit/deposit-context";
import { useOrderTracking } from "@/lib/deposit/use-order-tracking";
import { STAGES, progressFor, stageState, type Order } from "@/lib/deposit/orders";
import { useP2pWalletClient } from "@/hooks/use-p2p-wallet-client";
import { formatDayAndTime } from "@/lib/datetime";

export default function DepositTrackingScreen() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { t, language } = useI18n();
  const { format } = useMoney();
  const { getOrder, updateOrder } = useDeposit();

  const [order, setOrder] = useState<Order | null | undefined>(undefined);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       Orders are read from localStorage, which only exists after mount. */
    setOrder(getOrder(id) ?? null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [id, getOrder]);

  const handleOrderUpdate = useCallback(
    (orderId: string, patch: Partial<Order>) => {
      const updated = updateOrder(orderId, patch);
      if (updated) setOrder(updated);
      return updated;
    },
    [updateOrder]
  );

  useOrderTracking(order, handleOrderUpdate);

  if (order === undefined) return null;

  if (order === null) {
    return (
      <Screen title={t("depositFlow.track.title", { id })} backLabel={t("common.back")}>
        <p style={typography.body3} className="text-text-secondary">
          {t("depositFlow.track.notFound")}
        </p>
      </Screen>
    );
  }

  if (order.phase === "completed") {
    return <DepositReceipt order={order} />;
  }

  if (order.phase === "awaiting_payment") {
    return <PaymentStep order={order} onPaid={(updated) => setOrder(updated)} />;
  }

  const failed = order.phase === "failed";

  const label = failed
    ? order.failureReason === "cancelled"
      ? t("depositFlow.track.cancelled")
      : order.failureReason === "timeout"
        ? t("depositFlow.track.merchantTimeout")
        : t("depositFlow.track.orderError")
    : order.phase === "awaiting_completion"
      ? t("depositFlow.track.confirming")
      : t("depositFlow.track.finding");

  const caption = failed
    ? order.failureReason === "cancelled"
      ? t("depositFlow.track.cancelledHint")
      : order.failureReason === "timeout"
        ? t("depositFlow.track.merchantTimeoutHint", { id: order.id })
        : t("depositFlow.track.orderErrorHint", { id: order.id })
    : t("depositFlow.track.inProgress");

  const stageHints: Record<(typeof STAGES)[number], string> = {
    placed: t("depositFlow.stage.placedHint", { amount: format(order.quote.local) }),
    matched: t("depositFlow.stage.matchedHint"),
    paying: t("depositFlow.stage.payingHint"),
    received: t("depositFlow.stage.receivedHint"),
  };

  return (
    <Screen
      title={t("depositFlow.track.title", { id: order.id })}
      backLabel={t("common.back")}
      footer={
        <Button variant="secondary" onClick={() => router.replace("/home")}>
          {t("depositFlow.track.backHome")}
        </Button>
      }
    >
      <StatusCard
        label={label}
        progress={failed ? undefined : progressFor(order)}
        caption={caption}
        className={failed ? "bg-text-tertiary" : undefined}
      >
        <p style={typography.display4}>{format(order.quote.usdc)}</p>
      </StatusCard>

      <div className="mt-6">
        <Timeline
          steps={STAGES.map((key) => ({
            title: t(`depositFlow.stage.${key}`),
            subtitle: stageHints[key],
            state: failed && stageState(key, order) === "current" ? "pending" : stageState(key, order),
          }))}
        />
      </div>

      <Card className="mt-6 px-5 py-3">
        <DetailRow label={t("depositFlow.track.orderNumber")} value={order.id} />
        <DetailRow label={t("depositFlow.track.youPay")} value={format(order.quote.local)} />
        <DetailRow label={t("contacts.add.country")} value={countryName(order.quote.country, language)} />
      </Card>
    </Screen>
  );
}

/**
 * Shown once a seller has accepted and their payment address is decrypted.
 * The user pays outside the app — over their own bank or wallet app — then
 * confirms here, which submits `paidBuyOrder` and unlocks the seller's side
 * of the escrow.
 */
function PaymentStep({ order, onPaid }: { order: Order; onPaid: (order: Order) => void }) {
  const { t, language } = useI18n();
  const { format } = useMoney();
  const { markPaid } = useDeposit();
  const getWalletClient = useP2pWalletClient();

  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const method = localPayoutLabel(order.quote.country);
  const addressDisplay = order.paymentAddress
    ? formatLocalPayoutReference(order.quote.country, order.paymentAddress, language) || order.paymentAddress
    : "—";

  const copy = async () => {
    if (!order.paymentAddress) return;
    await navigator.clipboard.writeText(order.paymentAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePaid = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const { walletClient } = await getWalletClient();
      const updated = await markPaid({ orderId: order.id, walletClient });
      onPaid(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <Screen
      title={t("depositFlow.payment.titleVia", { method: method ?? t("depositFlow.payment.transferFallback") })}
      backLabel={t("common.back")}
      footer={
        <>
          <Button variant="black" onClick={handlePaid} disabled={submitting}>
            {submitting ? t("depositFlow.payment.confirming") : t("depositFlow.payment.confirmButton")}
          </Button>
          {error && (
            <p style={typography.body5} className="mt-3 text-center text-danger">
              {error}
            </p>
          )}
        </>
      }
    >
      <p style={typography.body3} className="text-text-secondary">
        {t("depositFlow.payment.subtitle")}
      </p>

      <Card className="mt-5 flex flex-col items-center px-5 py-6 text-center">
        <p style={typography.body3} className="text-text-tertiary">
          {t("depositFlow.payment.amountLabel")}
        </p>
        <p style={typography.display3} className="mt-1">
          {format(order.quote.local)}
        </p>
      </Card>

      <Card className="mt-4 px-5 py-5">
        <p style={typography.body3} className="text-text-tertiary">
          {t("depositFlow.payment.addressLabel")}
        </p>
        <p style={typography.body2} className="mt-2 break-words whitespace-pre-line">
          {addressDisplay}
        </p>
        {order.paymentAddress && (
          <button
            onClick={copy}
            style={typography.body4}
            className="mt-3 flex items-center gap-1.5 text-primary active:opacity-70"
          >
            <Copy size={14} />
            {copied ? t("cashflow.receive.copied") : t("depositFlow.payment.copy")}
          </button>
        )}
      </Card>

      {order.acceptedMerchant && (
        <Card className="mt-4 px-5 py-3">
          <DetailRow
            label={t("depositFlow.payment.merchantLabel")}
            value={
              <span className="font-mono text-xs">
                {order.acceptedMerchant.slice(0, 6)}...{order.acceptedMerchant.slice(-4)}
              </span>
            }
          />
        </Card>
      )}

      <Callout className="mt-4">
        {t("depositFlow.payment.warning", { amount: format(order.quote.local) })}
      </Callout>
    </Screen>
  );
}

function DepositReceipt({ order }: { order: Order }) {
  const router = useRouter();
  const { t, language } = useI18n();
  const { format } = useMoney();
  const { reset } = useDeposit();
  const settledAt = order.completedAt ?? order.createdAt;

  const handleDone = () => {
    reset();
    router.replace("/home");
  };

  return (
    <Screen footer={<Button variant="black" onClick={handleDone}>{t("depositFlow.done.button")}</Button>}>
      <div className="mt-10 flex flex-col items-center text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-white">
          <Check size={36} strokeWidth={3} />
        </span>
        <p style={typography.display3} className="mt-6">
          {format(order.quote.usdc)}
        </p>
        <p style={typography.body3} className="mt-1 text-text-secondary">
          {countryName(order.quote.country, language)} · {formatDayAndTime(settledAt, language)}
        </p>
      </div>

      <Card className="mt-8 px-5 py-3">
        <DetailRow label={t("depositFlow.done.paid")} value={format(order.quote.local)} />
        <DetailRow label={t("depositFlow.done.received")} value={format(order.quote.usdc)} emphasis />
        <DetailRow label={t("depositFlow.track.orderNumber")} value={order.id} />
        <DetailRow
          label={t("depositFlow.done.receipt")}
          value={<span className="break-all font-mono text-xs">{order.placeTxHash}</span>}
        />
      </Card>

      <p style={typography.body5} className="mt-4 text-center text-text-secondary">
        {t("depositFlow.done.receiptNote")}
      </p>
    </Screen>
  );
}
