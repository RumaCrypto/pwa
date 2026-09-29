"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/status-card";
import { DetailRow } from "@/components/ui/detail-row";
import { Timeline } from "@/components/ui/timeline";
import { Badge } from "@/components/ui/badge";
import { typography } from "@/constants/typography";

import { formatEther } from "viem";

import { truncateAddress } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n-context";
import { LOCALES } from "@/lib/i18n/languages";
import { useContacts } from "@/lib/contacts/contacts-context";
import { countryName, displayName, localPayoutLabel, payoutReferenceDisplay } from "@/lib/contacts/contacts";
import { useSend } from "@/lib/send/send-context";
import { useMoney } from "@/lib/money/money-context";
import { useOrderTracking } from "@/lib/send/use-order-tracking";
import {
  RUMA_STAGES,
  STAGES,
  progressFor,
  rumaProgressFor,
  rumaStageState,
  stageState,
  type Order,
  type RumaTransferOrder,
} from "@/lib/send/orders";

export default function SendTrackingScreen() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { t, language } = useI18n();
  const { findContact } = useContacts();
  const { getOrder, updateOrder } = useSend();
  const { format } = useMoney();

  const [order, setOrder] = useState<Order | null | undefined>(undefined);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       Orders are read from localStorage, which only exists after mount. */
    setOrder(getOrder(id) ?? null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [id, getOrder]);

  const contact = order ? findContact(order.contactId) : undefined;

  const handleOrderUpdate = useCallback(
    (orderId: string, patch: Partial<Order>) => {
      const updated = updateOrder(orderId, patch);
      if (updated) setOrder(updated);
      return updated;
    },
    [updateOrder]
  );

  useOrderTracking(order, contact, handleOrderUpdate);

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

  const name = contact ? displayName(contact) : t("common.to");

  if (order.kind === "ruma") {
    return <RumaTransferScreen order={order} name={name} contactName={contact?.name} country={contact ? countryName(contact.country, language) : undefined} address={contact?.payout.reference} />;
  }

  const failed = order.phase === "failed";

  const label = failed
    ? order.failureReason === "cancelled"
      ? t("sendFlow.track.cancelled")
      : order.failureReason === "timeout"
        ? t("sendFlow.track.merchantTimeout")
        : t("sendFlow.track.orderError")
    : order.phase === "completed"
      ? t("sendFlow.track.delivered", { name })
      : t("sendFlow.track.onItsWay", { name });

  const caption = failed
    ? order.failureReason === "cancelled"
      ? t("sendFlow.track.cancelledHint", { name })
      : order.failureReason === "timeout"
        ? t("sendFlow.track.merchantTimeoutHint", { id: order.id })
        : t("sendFlow.track.orderErrorHint", { id: order.id })
    : order.phase === "completed"
      ? undefined
      : t("sendFlow.track.inProgress");

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
        <Button variant="secondary" onClick={() => router.replace("/home")}>
          {t("sendFlow.track.backHome")}
        </Button>
      }
    >
      <StatusCard
        label={label}
        progress={failed ? undefined : progressFor(order)}
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
            title:
              key === "paying" || key === "delivered" ? t(`sendFlow.stage.${key}`, { name }) : t(`sendFlow.stage.${key}`),
            subtitle: stageHints[key],
            state: failed && stageState(key, order) === "current" ? "pending" : stageState(key, order),
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
              ? `${
                  contact.payout.kind === "local"
                    ? localPayoutLabel(contact.country)
                    : t(`contacts.payout.${contact.payout.kind}` as "contacts.payout.ruma" | "contacts.payout.cash")
                } ·· ${payoutReferenceDisplay(contact, language)}`
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

interface RumaTransferScreenProps {
  order: RumaTransferOrder;
  name: string;
  contactName?: string;
  country?: string;
  address?: string;
}

/**
 * A plain USDC transfer has no merchant and no conversion, so it gets its own
 * two-step view: submitted on the blockchain, then confirmed by its receipt.
 */
function RumaTransferScreen({ order, name, contactName, country, address }: RumaTransferScreenProps) {
  const router = useRouter();
  const { t } = useI18n();
  const { format } = useMoney();

  const failed = order.phase === "failed";
  const completed = order.phase === "completed";

  const label = failed
    ? t("sendFlow.track.orderError")
    : completed
      ? t("sendFlow.track.rumaDelivered", { name })
      : t("sendFlow.track.rumaSending", { name });
  const caption = failed
    ? t("sendFlow.track.orderErrorHint", { id: truncateAddress(order.id) })
    : completed
      ? undefined
      : t("sendFlow.track.rumaInProgress");

  const stageTitles = {
    submitted: t("sendFlow.rumaStage.submitted"),
    confirmed: t("sendFlow.rumaStage.confirmed"),
  };
  const stageHints = {
    submitted: t("sendFlow.rumaStage.submittedHint"),
    confirmed: completed
      ? t("sendFlow.rumaStage.confirmedHint", { name })
      : t("sendFlow.rumaStage.confirmedPendingHint"),
  };

  return (
    <Screen
      title={t("sendFlow.track.title", { id: truncateAddress(order.id) })}
      backLabel={t("common.back")}
      footer={
        <Button variant="secondary" onClick={() => router.replace("/home")}>
          {t("sendFlow.track.backHome")}
        </Button>
      }
    >
      <StatusCard
        label={label}
        progress={failed ? undefined : rumaProgressFor(order)}
        caption={caption}
        className={failed ? "bg-text-tertiary" : undefined}
      >
        <p style={typography.display4}>
          {format(order.quote.send, { symbol: false })}
          <small className="ml-1.5 text-lg opacity-60">USDC</small>
        </p>
      </StatusCard>

      <div className="mt-6">
        <Timeline
          steps={RUMA_STAGES.map((key) => ({
            title: stageTitles[key],
            subtitle: stageHints[key],
            state: rumaStageState(key, order),
          }))}
        />
      </div>

      <Card className="mt-6 px-5 py-3">
        <DetailRow label={t("sendFlow.track.orderNumber")} value={truncateAddress(order.id)} />
        <DetailRow label={t("sendFlow.track.recipient")} value={contactName ?? "—"} />
        <DetailRow
          label={t("sendFlow.track.receivesIn")}
          value={address ? `${t("contacts.payout.ruma")} ·· ${truncateAddress(address)}` : "—"}
        />
        {country && <DetailRow label={t("contacts.add.country")} value={country} />}
        <DetailRow
          label={t("sendFlow.track.networkFee")}
          value={
            <span className="inline-flex items-center gap-2">
              {order.networkFeeWei !== undefined && (
                <span className="text-text-tertiary line-through">
                  {Number(formatEther(order.networkFeeWei)).toFixed(7)} ETH
                </span>
              )}
              <Badge>{t("sendFlow.track.free")}</Badge>
            </span>
          }
        />
      </Card>
    </Screen>
  );
}
