"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n/i18n-context";
import { LANGUAGES, type Language } from "@/lib/i18n/languages";
import { useMoney } from "@/lib/money/money-context";
import { CURRENCIES, CURRENCY_CODES, type CurrencyCode } from "@/lib/money/currencies";
import { fromNumber } from "@/lib/money/money";
import { typography } from "@/constants/typography";

export default function SettingsPage() {
  const router = useRouter();
  const { t, language, setLanguage } = useI18n();
  const { displayCurrency, setDisplayCurrency, format } = useMoney();

  return (
    <div className="flex flex-1 flex-col px-6 pb-8 pt-6">
      <div className="mb-8 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          aria-label={t("common.back")}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border-light bg-white active:opacity-70"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 style={typography.heading2}>{t("settings")}</h1>
      </div>

      <section className="mb-8">
        <h2 style={typography.caption2} className="mb-3 uppercase text-text-secondary">
          {t("settings.selectLanguage")}
        </h2>
        <div className="overflow-hidden rounded-2xl border border-border-light bg-white">
          {LANGUAGES.map((lang, index) => (
            <Row
              key={lang}
              label={t(`settings.language.${lang}` as `settings.language.${Language}`)}
              selected={lang === language}
              divided={index > 0}
              onClick={() => setLanguage(lang)}
            />
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 style={typography.caption2} className="mb-3 uppercase text-text-secondary">
          {t("settings.selectCurrency")}
        </h2>
        <p style={typography.body4} className="mb-3 text-text-secondary">
          {t("settings.currencyHint")}
        </p>
        <div className="overflow-hidden rounded-2xl border border-border-light bg-white">
          {CURRENCY_CODES.map((code, index) => (
            <Row
              key={code}
              label={`${CURRENCIES[code].symbol}  ${code}`}
              selected={code === displayCurrency}
              divided={index > 0}
              onClick={() => setDisplayCurrency(code as CurrencyCode)}
            />
          ))}
        </div>
      </section>

      <div className="rounded-2xl bg-primary-light px-4 py-4">
        <p style={typography.label4} className="text-primary-dark">
          {t("tabs.home.balance")}
        </p>
        <p style={typography.heading2} className="mt-1 text-primary-dark">
          {format(fromNumber(1080.5, displayCurrency))}
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  selected,
  divided,
  onClick,
}: {
  label: string;
  selected: boolean;
  divided: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={typography.body1}
      className={clsx(
        "flex w-full items-center justify-between px-4 py-3.5 text-left active:bg-card",
        divided && "border-t border-border-light"
      )}
    >
      <span>{label}</span>
      {selected && <Check size={18} className="text-primary" />}
    </button>
  );
}
