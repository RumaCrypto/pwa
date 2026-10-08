"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListRow } from "@/components/ui/list-row";
import { Keypad } from "@/components/ui/keypad";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { LOCALES } from "@/lib/i18n/languages";
import { useResidency } from "@/lib/settings/residency-context";
import { countryName, formatLocalPayoutReference, localPayoutLabel, packLocalPayoutReference } from "@/lib/contacts/contacts";
import { currencyForCountry } from "@/lib/money/currencies";
import { useWithdraw } from "@/lib/withdraw/withdraw-context";
import { useRate } from "@/lib/money/rates";
import { useMoney } from "@/lib/money/money-context";
import { appendDecimal, appendDigit, backspace, formatDraft, toMoney } from "@/lib/money/amount-input";
import { convert, fromDecimalString } from "@/lib/money/money";
import { buildQuote } from "@/lib/send/quote";
import { useUsdcBalance } from "@/hooks/use-usdc-balance";
import { usePrivy } from "@privy-io/react-auth";

const QUICK = [20, 50, 100];

export default function WithdrawAmountStep() {
  const router = useRouter();
  const { t, language } = useI18n();
  const { country, loaded } = useResidency();
  const { details, draft, setDraft, setQuote } = useWithdraw();
  const { format } = useMoney();
  const { user } = usePrivy();
  const { balance } = useUsdcBalance(user?.wallet?.address);

  const target = (country && currencyForCountry(country)) || "USD";
  // Sell-side rate, since this quotes what the user gets for selling USDC.
  const { rate, loading, error } = useRate("USD", target, country ?? undefined);

  const hasDetails = Object.keys(details).length > 0;

  useEffect(() => {
    // Details live in memory only for the session's flow; a reload restarts at step one.
    if (loaded && (!country || !hasDetails)) router.replace("/withdraw/bank");
  }, [loaded, country, hasDetails, router]);

  if (!country || !hasDetails) return null;

  const send = toMoney(draft, "USD");
  const receive = rate !== null ? convert(send, rate, target) : null;
  const overBalance = balance !== null && send.amount > fromDecimalString(balance, "USD").amount;
  const ready = send.amount > 0n && rate !== null && !overBalance;

  const separator =
    new Intl.NumberFormat(LOCALES[language]).formatToParts(1.1).find((p) => p.type === "decimal")?.value ??
    ".";

  const handleContinue = () => {
    if (rate === null) return;
    setQuote(buildQuote(send, rate, target));
    router.push("/withdraw/bank/review");
  };

  return (
    <Screen
      title={t("withdrawFlow.amount.title")}
      backLabel={t("common.back")}
      step={{ current: 2, total: 3 }}
      footer={
        <Button onClick={handleContinue} disabled={!ready}>
          {t("cashflow.continue")}
        </Button>
      }
    >
      <Card>
        <ListRow
          title={localPayoutLabel(country) ?? ""}
          subtitle={`${countryName(country, language)} · ${
            formatLocalPayoutReference(country, packLocalPayoutReference(country, details), language)
          }`}
          trailing={
            <span style={typography.body3} className="shrink-0 text-text-secondary">
              {t("sendFlow.step2.change")}
            </span>
          }
          onClick={() => router.replace("/withdraw/bank")}
        />
      </Card>

      <Card className="mt-4 px-5 py-5">
        <p style={typography.body3} className="text-text-tertiary">
          {t("sendFlow.step2.youSend")}
        </p>
        <p style={typography.display2} className="mt-1 break-all">
          <small className="text-3xl opacity-50">$</small>
          {formatDraft(draft, LOCALES[language], "USD") || "0"}
        </p>

        <div className="my-4 border-t border-border-light" />

        <p style={typography.body4} className={clsx(error ? "text-danger" : "text-primary-dark")}>
          {loading
            ? t("sendFlow.step2.rateLoading")
            : error
              ? t("sendFlow.step2.rateError")
              : t("sendFlow.step2.rate", {
                  from: "USD",
                  rate: new Intl.NumberFormat(LOCALES[language], { maximumFractionDigits: 2 }).format(rate ?? 0),
                  to: target,
                })}
        </p>

        <p style={typography.body3} className="mt-4 text-text-tertiary">
          {t("withdrawFlow.amount.receive")}
        </p>
        <p style={typography.heading1} className="mt-0.5">
          {receive ? format(receive) : "—"}
        </p>
      </Card>

      {overBalance && (
        <p style={typography.body4} className="mt-3 text-danger">
          {t("withdrawFlow.amount.overBalance")}
        </p>
      )}

      <div className="mt-5 grid grid-cols-3 gap-3">
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
    </Screen>
  );
}
