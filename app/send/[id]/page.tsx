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
import { LOCALES } from "@/lib/i18n/languages";
import { useContacts } from "@/lib/contacts/contacts-context";
import { countryName, displayName } from "@/lib/contacts/contacts";
import { useSend } from "@/lib/send/send-context";
import { useMoney } from "@/lib/money/money-context";
import { formatTime } from "@/lib/datetime";
import { STAGES, canCancel, estimatedArrival, progressAt, stageAt, stageStateAt, type Order } from "@/lib/send/orders";

export default function SendTrackingScreen() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { t, language } = useI18n();
  const { findContact } = useContacts();
  const { getOrder, cancelOrder } = useSend();
  const { format } = useMoney();

  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       Orders are read from localStorage, which only exists after mount. */
    setOrder(getOrder(id) ?? null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [id, getOrder]);

  // The stage is derived from elapsed time, so the screen advances by re-reading
  // the clock rather than by holding timers that a reload would lose.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (order === undefined) return null;

  if (order === null) {
    return (
      <Screen title={t("sendFlow.track.title", { id })} backLabel={t("common.back")}>
        <p style={typography.body3} className="text-text-secondary">
          {t("sendFlow.track.notFound")}
        </p>
      </Screen>
    );
  }

  const contact = findContact(order.contactId);
  const name = contact ? displayName(contact) : t("common.to");
  const stage = stageAt(order.createdAt, now, order.cancelledAt);
  const cancelled = Boolean(order.cancelledAt);

  const handleCancel = () => setOrder(cancelOrder(order.id) ?? order);
  const arrival = estimatedArrival(order.createdAt);

  const stageHints: Record<(typeof STAGES)[number], string> = {
    funded: t("sendFlow.stage.fundedHint", { amount: format(order.quote.total) }),
    converted: t("sendFlow.stage.convertedHint", {
      rate: new Intl.NumberFormat(LOCALES[language], { maximumFractionDigits: 2 }).format(order.quote.rate),
    }),
    paying: t("sendFlow.stage.payingHint"),
    delivered: t("sendFlow.stage.deliveredHint"),
  };

  return (
    <Screen
      title={t("sendFlow.track.title", { id: order.id })}
      backLabel={t("common.back")}
      footer={
        <>
          <Button variant="secondary" onClick={() => router.replace("/home")}>
            {t("sendFlow.track.backHome")}
          </Button>
          {canCancel(order, now) && (
            <button
              onClick={handleCancel}
              style={typography.body3}
              className="mt-3 w-full text-center text-danger active:opacity-70"
            >
              {t("sendFlow.track.cancel")}
            </button>
          )}
        </>
      }
    >
      <StatusCard
        label={
          cancelled
            ? t("sendFlow.track.cancelled")
            : stage === "delivered"
              ? t("sendFlow.track.delivered", { name })
              : t("sendFlow.track.onItsWay", { name })
        }
        progress={cancelled ? undefined : progressAt(order.createdAt, now)}
        caption={
          cancelled
            ? t("sendFlow.track.cancelledHint", { name })
            : stage === "delivered"
              ? undefined
              : t("sendFlow.track.arrivesBy", { time: formatTime(arrival, language) })
        }
        className={cancelled ? "bg-text-tertiary" : undefined}
      >
        <p style={typography.display4}>
          {format(order.quote.receive, { symbol: false })}
          <small className="ml-1.5 text-lg opacity-60">{order.quote.receive.currency}</small>
        </p>
      </StatusCard>

      <div className="mt-6">
        <Timeline
          steps={STAGES.map((key) => ({
            title:
              key === "paying" || key === "delivered"
                ? t(`sendFlow.stage.${key}`, { name })
                : t(`sendFlow.stage.${key}`),
            subtitle: stageHints[key],
            state: cancelled
              ? stageStateAt(key, order.createdAt, order.cancelledAt!) === "current"
                ? "pending"
                : stageStateAt(key, order.createdAt, order.cancelledAt!)
              : stageStateAt(key, order.createdAt, now),
          }))}
        />
      </div>

      <Card className="mt-6 px-5 py-3">
        <DetailRow label={t("sendFlow.track.orderNumber")} value={order.id} />
        <DetailRow label={t("sendFlow.track.recipient")} value={contact?.name ?? "—"} />
        <DetailRow
          label={t("sendFlow.track.receivesIn")}
          value={
            contact
              ? `${t(`contacts.payout.${contact.payout.kind}` as "contacts.payout.pix")} ·· ${contact.payout.reference}`
              : "—"
          }
        />
        {contact && (
          <DetailRow label={t("contacts.add.country")} value={countryName(contact.country, language)} />
        )}
      </Card>
    </Screen>
  );
}
