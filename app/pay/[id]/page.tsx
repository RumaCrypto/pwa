"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check } from "lucide-react";

import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusCard } from "@/components/ui/status-card";
import { DetailRow } from "@/components/ui/detail-row";
import { Timeline } from "@/components/ui/timeline";
import { QrFrame } from "@/components/ui/qr-frame";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { LOCALES } from "@/lib/i18n/languages";
import { useMoney } from "@/lib/money/money-context";
import { usePay } from "@/lib/pay/pay-context";
import { PAY_STEPS, payProgressAt, payStageAt, stepStateAt, type Payment } from "@/lib/pay/payments";
import { formatDayAndTime } from "@/lib/datetime";

export default function PayTrackingScreen() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { t, language } = useI18n();
  const { format } = useMoney();
  const { getPayment, markScanned } = usePay();

  const [payment, setPayment] = useState<Payment | null | undefined>(undefined);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       Payments are read from localStorage, which only exists after mount. */
    setPayment(getPayment(id) ?? null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [id, getPayment]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (payment === undefined) return null;

  if (payment === null) {
    return (
      <Screen title={t("payFlow.track.title", { id })} backLabel={t("common.back")}>
        <p style={typography.body3} className="text-text-secondary">
          {t("payFlow.track.notFound")}
        </p>
      </Screen>
    );
  }

  const stage = payStageAt(payment, now);
  const percent = Math.round(payment.payer.reliability * 100);

  const handleScanned = () => {
    markScanned(payment.id);
    setPayment(getPayment(payment.id) ?? payment);
  };

  if (stage === "settled") {
    return <PaymentReceipt payment={payment} />;
  }

  const payments = new Intl.NumberFormat(LOCALES[language]).format(payment.payer.payments);

  const steps = PAY_STEPS.map((step) => {
    const state = stepStateAt(step, payment, now);
    const done = state === "done";

    if (step === "payer") {
      return {
        title: t("payFlow.step.payer"),
        // The designs only surface the payer's record once the QR is on its way;
        // before that the useful fact is that the money is already reserved.
        subtitle:
          stage === "assigned"
            ? t("payFlow.step.payerHintWaiting")
            : t("payFlow.step.payerHintDone", { percent, payments }),
        state,
      };
    }
    if (step === "scan") {
      return {
        title: done ? t("payFlow.step.scanDone") : t("payFlow.step.scan"),
        subtitle: done ? t("payFlow.step.scanHintDone") : t("payFlow.step.scanHintWaiting"),
        state,
      };
    }
    return {
      title: t("payFlow.step.charge"),
      subtitle: done || state === "current"
        ? t("payFlow.step.chargeHintDone")
        : t("payFlow.step.chargeHintWaiting"),
      state,
    };
  });

  return (
    <Screen
      title={t("payFlow.track.title", { id: payment.id })}
      backLabel={t("common.back")}
      footer={
        <>
          <Button variant="secondary" onClick={() => router.replace("/home")}>
            {t("payFlow.track.backHome")}
          </Button>
          {/* No support channel exists yet; showing it as live would be a lie. */}
          <p style={typography.body3} className="mt-3 text-center text-text-disabled">
            {t("payFlow.track.report")} · {t("payFlow.track.reportSoon")}
          </p>
        </>
      }
    >
      {stage === "assigned" ? (
        <>
          <QrFrame
            onScanned={handleScanned}
            label={t("payFlow.track.scanLabel")}
            hint={t("payFlow.track.cameraPlaceholder")}
          />
          <button
            style={typography.label3}
            className="mt-4 w-full text-center text-primary active:opacity-70"
            onClick={handleScanned}
          >
            {t("payFlow.track.uploadFromGallery")}
          </button>
        </>
      ) : (
        <StatusCard
          label={t("payFlow.track.payingBusiness")}
          progress={payProgressAt(payment, now)}
          caption={t("payFlow.track.hasYourQr")}
        >
          <p style={typography.display4}>{format(payment.amount)}</p>
        </StatusCard>
      )}

      <Card className="mt-5 flex items-center gap-3 px-4 py-4">
        <div className="min-w-0 flex-1">
          <p style={typography.heading4}>{t("payFlow.track.havePayer")}</p>
          <p style={typography.body4} className="mt-0.5 text-text-secondary">
            {t("payFlow.track.payerStats", {
              payments,
              seconds: payment.payer.respondsInSeconds,
            })}
          </p>
        </div>
        <Badge>{t("payFlow.track.reliability", { percent })}</Badge>
      </Card>

      <div className="mt-6">
        <Timeline steps={steps} />
      </div>

      <Card className="mt-6 px-5 py-3">
        <DetailRow label={t("payFlow.track.paymentNumber")} value={payment.id} />
        <DetailRow label={t("payFlow.track.youPay")} value={format(payment.total)} />
      </Card>
    </Screen>
  );
}

function PaymentReceipt({ payment }: { payment: Payment }) {
  const router = useRouter();
  const { t, language } = useI18n();
  const { format } = useMoney();
  const settledAt = payment.scannedAt ?? payment.createdAt;

  return (
    <Screen footer={<Button variant="black" onClick={() => router.replace("/home")}>{t("payFlow.done.button")}</Button>}>
      <div className="mt-10 flex flex-col items-center text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-white">
          <Check size={36} strokeWidth={3} />
        </span>
        <p style={typography.display3} className="mt-6">
          {format(payment.amount)}
        </p>
        <p style={typography.body3} className="mt-1 text-text-secondary">
          {payment.merchant ? `${payment.merchant} · ` : ""}
          {formatDayAndTime(settledAt, language)}
        </p>
      </div>

      <Card className="mt-8 px-5 py-3">
        <DetailRow label={t("payFlow.done.paid")} value={format(payment.total)} />
        <DetailRow label={t("payFlow.done.cost")} value={format(payment.fee)} />
        <DetailRow label={t("payFlow.track.paymentNumber")} value={payment.id} />
        <DetailRow
          label={t("payFlow.done.receipt")}
          value={
            <span className="break-all font-mono text-xs">{payment.receipt}</span>
          }
        />
      </Card>

      <p style={typography.body5} className="mt-4 text-center text-text-secondary">
        {t("payFlow.done.receiptNote")}
      </p>
    </Screen>
  );
}
