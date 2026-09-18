"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { QRParserError, parseQR } from "@p2pdotme/sdk/qr-parsers";

import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/status-card";
import { DetailRow } from "@/components/ui/detail-row";
import { Timeline } from "@/components/ui/timeline";
import { QrScanner } from "@/components/ui/qr-scanner";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { countryName } from "@/lib/contacts/contacts";
import { useMoney } from "@/lib/money/money-context";
import { usePay } from "@/lib/pay/pay-context";
import { useOrderTracking } from "@/lib/pay/use-order-tracking";
import { payCurrencyForCountry } from "@/lib/pay/quote";
import { pixProxyUrl } from "@/lib/pay/pix-proxy";
import { useP2pWalletClient } from "@/hooks/use-p2p-wallet-client";
import { STAGES, progressFor, stageState, type Order } from "@/lib/pay/orders";
import { formatDayAndTime } from "@/lib/datetime";

const QR_ERROR_KEYS: Record<string, "payFlow.track.scanInvalid" | "payFlow.track.scanRateError"> = {
  INVALID_QR: "payFlow.track.scanInvalid",
  INVALID_CURRENCY: "payFlow.track.scanInvalid",
  INVALID_AMOUNT: "payFlow.track.scanInvalid",
  FETCH_FAILED: "payFlow.track.scanRateError",
};

export default function PayTrackingScreen() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { t, language } = useI18n();
  const { format } = useMoney();
  const { getOrder, updateOrder } = usePay();

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
      <Screen title={t("payFlow.track.title", { id })} backLabel={t("common.back")}>
        <p style={typography.body3} className="text-text-secondary">
          {t("payFlow.track.notFound")}
        </p>
      </Screen>
    );
  }

  if (order.phase === "completed") {
    return <PaymentReceipt order={order} />;
  }

  if (order.phase === "awaiting_scan") {
    return <ScanStep order={order} onScanned={(updated) => setOrder(updated)} />;
  }

  const failed = order.phase === "failed";

  const label = failed
    ? order.failureReason === "cancelled"
      ? t("payFlow.track.cancelled")
      : order.failureReason === "timeout"
        ? t("payFlow.track.merchantTimeout")
        : t("payFlow.track.orderError")
    : t("payFlow.track.paying");

  const caption = failed
    ? order.failureReason === "cancelled"
      ? t("payFlow.track.cancelledHint")
      : order.failureReason === "timeout"
        ? t("payFlow.track.merchantTimeoutHint", { id: order.id })
        : t("payFlow.track.orderErrorHint", { id: order.id })
    : t("payFlow.track.inProgress");

  const stageHints: Record<(typeof STAGES)[number], string> = {
    funded: t("payFlow.stage.fundedHint", { amount: format(order.quote.total) }),
    matched: t("payFlow.stage.matchedHint"),
    paying: t("payFlow.stage.payingHint"),
    settled: t("payFlow.stage.settledHint"),
  };

  return (
    <Screen
      title={t("payFlow.track.title", { id: order.id })}
      backLabel={t("common.back")}
      footer={
        <Button variant="secondary" onClick={() => router.replace("/home")}>
          {t("payFlow.track.backHome")}
        </Button>
      }
    >
      <StatusCard
        label={label}
        progress={failed ? undefined : progressFor(order)}
        caption={caption}
        className={failed ? "bg-text-tertiary" : undefined}
      >
        <p style={typography.display4}>{format(order.quote.local)}</p>
      </StatusCard>

      <div className="mt-6">
        <Timeline
          steps={STAGES.map((key) => ({
            title: t(`payFlow.stage.${key}`),
            subtitle: stageHints[key],
            state: failed && stageState(key, order) === "current" ? "pending" : stageState(key, order),
          }))}
        />
      </div>

      <Card className="mt-6 px-5 py-3">
        <DetailRow label={t("payFlow.track.paymentNumber")} value={order.id} />
        <DetailRow label={t("payFlow.track.youPay")} value={format(order.quote.total)} />
        <DetailRow label={t("contacts.add.country")} value={countryName(order.quote.country, language)} />
      </Card>
    </Screen>
  );
}

/**
 * Shown only once a merchant has accepted and is waiting on the payment
 * address — the SDK's own PAY walkthrough scans the QR at this point, not
 * before placing the order, since there's nothing to encrypt for the
 * merchant until their public key is known.
 */
function ScanStep({ order, onScanned }: { order: Order; onScanned: (order: Order) => void }) {
  const { t } = useI18n();
  const { submitScannedAddress } = usePay();
  const getWalletClient = useP2pWalletClient();

  const [stage, setStage] = useState<"scanning" | "reading" | "sending">("scanning");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = () => {
    setError(null);
    setStage("scanning");
    setAttempt((n) => n + 1);
  };

  const handleScan = async (raw: string) => {
    setStage("reading");
    setError(null);

    const result = await parseQR({
      qrData: raw,
      currency: payCurrencyForCountry(order.quote.country),
      sellPrice: order.quote.rate,
      proxyUrl: pixProxyUrl(),
    });

    if (result.isErr()) {
      const key = result.error instanceof QRParserError ? QR_ERROR_KEYS[result.error.code] : undefined;
      setError(t(key ?? "payFlow.track.scanInvalid"));
      setStage("scanning");
      return;
    }

    try {
      setStage("sending");
      const { walletClient } = await getWalletClient();
      const updated = await submitScannedAddress({
        orderId: order.id,
        paymentAddress: result.value.paymentAddress,
        walletClient,
      });
      onScanned(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStage("scanning");
    }
  };

  return (
    <Screen title={t("payFlow.track.title", { id: order.id })} backLabel={t("common.back")}>
      <p style={typography.body3} className="text-text-secondary">
        {t("payFlow.track.scanHint")}
      </p>

      <div className="mt-6">
        {stage === "scanning" ? (
          <QrScanner
            key={attempt}
            onScanned={handleScan}
            label={t("payFlow.track.scanHint")}
            permissionDeniedLabel={t("payFlow.track.scanPermissionDenied")}
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded-3xl bg-primary-dark">
            <p style={typography.body3} className="text-white/70">
              {stage === "reading" ? t("payFlow.track.scanReading") : t("payFlow.track.scanSubmitting")}
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-5 text-center">
          <p style={typography.body3} className="text-danger">
            {error}
          </p>
          <Button variant="secondary" className="mt-4" onClick={retry}>
            {t("payFlow.track.scanRetry")}
          </Button>
        </div>
      )}
    </Screen>
  );
}

function PaymentReceipt({ order }: { order: Order }) {
  const router = useRouter();
  const { t, language } = useI18n();
  const { format } = useMoney();
  const settledAt = order.completedAt ?? order.createdAt;

  return (
    <Screen footer={<Button variant="black" onClick={() => router.replace("/home")}>{t("payFlow.done.button")}</Button>}>
      <div className="mt-10 flex flex-col items-center text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-white">
          <Check size={36} strokeWidth={3} />
        </span>
        <p style={typography.display3} className="mt-6">
          {format(order.quote.local)}
        </p>
        <p style={typography.body3} className="mt-1 text-text-secondary">
          {countryName(order.quote.country, language)} · {formatDayAndTime(settledAt, language)}
        </p>
      </div>

      <Card className="mt-8 px-5 py-3">
        <DetailRow label={t("payFlow.done.paid")} value={format(order.quote.total)} />
        <DetailRow label={t("payFlow.done.cost")} value={format(order.quote.fee)} />
        <DetailRow label={t("payFlow.track.paymentNumber")} value={order.id} />
        <DetailRow
          label={t("payFlow.done.receipt")}
          value={<span className="break-all font-mono text-xs">{order.placeTxHash}</span>}
        />
      </Card>

      <p style={typography.body5} className="mt-4 text-center text-text-secondary">
        {t("payFlow.done.receiptNote")}
      </p>
    </Screen>
  );
}
