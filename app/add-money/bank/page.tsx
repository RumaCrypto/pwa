"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Keypad } from "@/components/ui/keypad";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { LOCALES } from "@/lib/i18n/languages";
import { useMoney } from "@/lib/money/money-context";
import { useDeposit } from "@/lib/deposit/deposit-context";
import { buildDepositQuote, localCurrencyForCountry } from "@/lib/deposit/quote";
import { useRate } from "@/lib/money/rates";
import { p2pBuyRateProvider, p2pBuyCountryOverrideRate } from "@/lib/money/p2p-prices";
import { convert } from "@/lib/money/money";
import { appendDecimal, appendDigit, backspace, formatDraft, toMoney } from "@/lib/money/amount-input";
import { useResidency } from "@/lib/settings/residency-context";

export default function AddMoneyBankAmountStep() {
  const router = useRouter();
  const { t, language } = useI18n();
  const { format } = useMoney();
  const { setQuote } = useDeposit();
  const { country, loaded } = useResidency();

  const [draft, setDraft] = useState("");

  const currency = country ? localCurrencyForCountry(country) : "USD";
  const { rate, loading, error } = useRate(
    "USD",
    currency,
    country ?? undefined,
    p2pBuyRateProvider,
    p2pBuyCountryOverrideRate
  );

  if (!loaded) return null;

  if (!country) {
    return (
      <Screen
        title={t("depositFlow.amount.title")}
        backLabel={t("common.back")}
        footer={
          <Button variant="black" onClick={() => router.push("/settings")}>
            {t("depositFlow.amount.setCountry")}
          </Button>
        }
      >
        <p style={typography.body3} className="text-text-secondary">
          {t("depositFlow.amount.needsCountry")}
        </p>
      </Screen>
    );
  }

  const local = toMoney(draft, currency);
  const usdc = local.amount > 0n && rate !== null ? convert(local, 1 / rate, "USD") : null;
  const ready = local.amount > 0n && rate !== null;

  const separator =
    new Intl.NumberFormat(LOCALES[language]).formatToParts(1.1).find((p) => p.type === "decimal")?.value ??
    ".";

  const handleContinue = () => {
    if (rate === null) return;
    setQuote(buildDepositQuote(local, rate, country));
    router.push("/add-money/bank/review");
  };

  return (
    <Screen
      title={t("depositFlow.amount.title")}
      backLabel={t("common.back")}
      step={{ current: 1, total: 2 }}
      footer={
        <Button variant="black" onClick={handleContinue} disabled={!ready}>
          {t("depositFlow.amount.continue")}
        </Button>
      }
    >
      <p style={typography.body3} className="text-text-secondary">
        {t("depositFlow.amount.hint")}
      </p>

      <div className="mt-8 text-center">
        <p style={typography.body3} className="text-text-tertiary">
          {t("depositFlow.amount.sending")}
        </p>
        <p style={typography.display1} className="mt-1 break-all">
          {formatDraft(draft, LOCALES[language], currency) || "0"}
          <small className="ml-1 text-2xl text-text-secondary">{currency}</small>
        </p>
      </div>

      <Card className="mt-5 flex items-center justify-between gap-3 px-4 py-4">
        <p style={typography.heading4}>{t("depositFlow.amount.usdc")}</p>
        <p style={typography.heading4} className={error ? "text-danger" : undefined}>
          {loading ? t("sendFlow.step2.rateLoading") : error ? t("sendFlow.step2.rateError") : usdc ? format(usdc) : "—"}
        </p>
      </Card>

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
