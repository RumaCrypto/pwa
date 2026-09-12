"use client";

import { useRouter } from "next/navigation";

import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { Callout } from "@/components/ui/callout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Keypad } from "@/components/ui/keypad";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { LOCALES } from "@/lib/i18n/languages";
import { useMoney } from "@/lib/money/money-context";
import { usePay } from "@/lib/pay/pay-context";
import { buildPayment } from "@/lib/pay/payments";
import { appendDecimal, appendDigit, backspace, formatDraft, toMoney } from "@/lib/money/amount-input";

const QUICK = [5, 10, 20];

export default function PayAmountScreen() {
  const router = useRouter();
  const { t, language } = useI18n();
  const { format } = useMoney();
  const { draft, setDraft, savePayment } = usePay();

  const amount = toMoney(draft, "USD");
  const preview = buildPayment(amount);
  const ready = amount.amount > 0n;

  const separator =
    new Intl.NumberFormat(LOCALES[language]).formatToParts(1.1).find((p) => p.type === "decimal")?.value ??
    ".";

  const handleContinue = () => {
    const payment = buildPayment(amount);
    savePayment(payment);
    setDraft("");
    router.replace(`/pay/${payment.id}`);
  };

  return (
    <Screen
      title={t("payFlow.amount.title")}
      backLabel={t("common.back")}
      footer={
        <Button variant="black" onClick={handleContinue} disabled={!ready}>
          {t("payFlow.amount.continue")}
        </Button>
      }
    >
      <Callout>{t("payFlow.amount.hint")}</Callout>

      <div className="mt-8 text-center">
        <p style={typography.body3} className="text-text-tertiary">
          {t("payFlow.amount.paying")}
        </p>
        <p style={typography.display1} className="mt-1 break-all">
          <small className="text-3xl text-text-secondary">$</small>
          {formatDraft(draft, LOCALES[language], "USD") || "0"}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {QUICK.map((value) => (
          <button
            key={value}
            onClick={() => setDraft(String(value))}
            style={typography.label1}
            className="h-12 rounded-xl border border-border-light bg-white active:bg-card"
          >
            ${value}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <Keypad
          decimalSeparator={separator}
          backspaceLabel={t("common.back")}
          onDigit={(digit) => setDraft(appendDigit(draft, digit))}
          onDecimal={() => setDraft(appendDecimal(draft))}
          onBackspace={() => setDraft(backspace(draft))}
        />
      </div>

      <Card className="mt-5 flex items-center gap-3 px-4 py-4">
        <div className="min-w-0 flex-1">
          <p style={typography.heading4}>{t("payFlow.amount.weCover")}</p>
          <p style={typography.body4} className="mt-0.5 text-text-secondary">
            {t("payFlow.amount.weCoverHint")}
          </p>
        </div>
        <Badge>{format(preview.fee)}</Badge>
      </Card>
    </Screen>
  );
}
