"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/status-card";
import { DetailRow } from "@/components/ui/detail-row";
import { Timeline } from "@/components/ui/timeline";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { LOCALES } from "@/lib/i18n/languages";
import { countryName, formatLocalPayoutReference, localPayoutLabel } from "@/lib/contacts/contacts";
import { useWithdraw, type WithdrawOrder } from "@/lib/withdraw/withdraw-context";
import { useMoney } from "@/lib/money/money-context";
import { useOrderTracking } from "@/lib/send/use-order-tracking";
import { STAGES, progressFor, stageState } from "@/lib/send/orders";
import type { OrderPatch } from "@/lib/send/send-context";

export default function WithdrawTrackingScreen() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { t, language } = useI18n();
  const { getOrder, updateOrder } = useWithdraw();
  const { format } = useMoney();

  const [order, setOrder] = useState<WithdrawOrder | null | undefined>(undefined);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       Orders are read from localStorage, which only exists after mount. */
    setOrder(getOrder(id) ?? null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [id, getOrder]);

  const handleOrderUpdate = useCallback(
    (orderId: string, patch: OrderPatch) => {
      const updated = updateOrder(orderId, patch);
      if (updated) setOrder(updated);
      return updated;
    },
    [updateOrder]
  );

  useOrderTracking(order, order?.payoutReference, handleOrderUpdate);

  if (order === undefined) return null;

  if (order === null) {
    return (
      <Screen title={t("withdrawFlow.track.title", { id })} backLabel={t("common.back")}>
        <p style={typography.body3} className="text-text-secondary">
          {t("withdrawFlow.track.notFound")}
        </p>
      </Screen>
    );
  }

  const failed = order.phase === "failed";
  // A stored order needs an `Order`-shaped value for the stage helpers, which only read these fields.
  const staged = { ...order, contactId: "" };

  const label = failed
    ? order.failureReason === "cancelled"
      ? t("withdrawFlow.track.cancelled")
      : order.failureReason === "timeout"
        ? t("sendFlow.track.merchantTimeout")
        : t("sendFlow.track.orderError")
    : order.phase === "completed"
      ? t("withdrawFlow.track.delivered")
      : t("withdrawFlow.track.onItsWay");

  const caption = failed
    ? order.failureReason === "cancelled"
      ? t("withdrawFlow.track.cancelledHint")
      : order.failureReason === "timeout"
        ? t("sendFlow.track.merchantTimeoutHint", { id: order.id })
        : t("sendFlow.track.orderErrorHint", { id: order.id })
    : order.phase === "completed"
      ? undefined
      : t("sendFlow.track.inProgress");

  const stageHints: Record<(typeof STAGES)[number], string> = {
    funded: t("withdrawFlow.stage.fundedHint", { amount: format(order.quote.total) }),
    converted: t("sendFlow.stage.convertedHint", {
      rate: new Intl.NumberFormat(LOCALES[language], { maximumFractionDigits: 2 }).format(order.quote.rate),
    }),
    paying: t("withdrawFlow.stage.payingHint"),
    delivered: t("withdrawFlow.stage.deliveredHint"),
  };

  return (
    <Screen
      title={t("withdrawFlow.track.title", { id: order.id })}
      backLabel={t("common.back")}
      footer={
        <Button variant="secondary" onClick={() => router.replace("/home")}>
          {t("sendFlow.track.backHome")}
        </Button>
      }
    >
      <StatusCard
        label={label}
        progress={failed ? undefined : progressFor(staged)}
        caption={caption}
        className={failed ? "bg-text-tertiary" : undefined}
      >
        <p style={typography.display4}>
          {format(order.quote.receive, { symbol: false })}
          <small className="ml-1.5 text-lg opacity-60">{order.quote.receive.currency}</small>
        </p>
      </StatusCard>

      <div className="mt-6">
        <Timeline
          steps={STAGES.map((key) => ({
            title: t(`withdrawFlow.stage.${key}`),
            subtitle: stageHints[key],
            state: failed && stageState(key, staged) === "current" ? "pending" : stageState(key, staged),
          }))}
        />
      </div>

      <Card className="mt-6 px-5 py-3">
        <DetailRow label={t("withdrawFlow.track.orderNumber")} value={order.id} />
        <DetailRow
          label={t("sendFlow.track.receivesIn")}
          value={`${localPayoutLabel(order.country) ?? ""} ·· ${formatLocalPayoutReference(order.country, order.payoutReference, language)}`}
        />
        <DetailRow label={t("contacts.add.country")} value={countryName(order.country, language)} />
      </Card>
    </Screen>
  );
}
