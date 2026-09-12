"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { ListRow } from "@/components/ui/list-row";
import { Keypad } from "@/components/ui/keypad";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { LOCALES } from "@/lib/i18n/languages";
import { useContacts } from "@/lib/contacts/contacts-context";
import { countryName, currencyOf, displayName } from "@/lib/contacts/contacts";
import { useSend } from "@/lib/send/send-context";
import { useRate } from "@/lib/money/rates";
import { useMoney } from "@/lib/money/money-context";
import { appendDecimal, appendDigit, backspace, formatDraft, toMoney } from "@/lib/money/amount-input";
import { convert } from "@/lib/money/money";
import { buildQuote } from "@/lib/send/quote";
import { currentLimits } from "@/lib/limits/limits";

const QUICK = [20, 50, 100];

export default function SendAmountStep() {
  const router = useRouter();
  const { t, language } = useI18n();
  const { findContact, loaded } = useContacts();
  const { contactId, draft, setDraft, setQuote } = useSend();
  const { format } = useMoney();

  const contact = contactId ? findContact(contactId) : undefined;
  const target = contact ? currencyOf(contact) : "USD";
  const { rate, loading, error } = useRate("USD", target);

  useEffect(() => {
    // Waiting for `loaded` matters most right after creating a contact, when the
    // store has not yet published it and bouncing would undo the user's choice.
    if (loaded && !contact) router.replace("/send");
  }, [loaded, contact, router]);

  if (!contact) return null;

  const send = toMoney(draft, "USD");
  const receive = rate !== null ? convert(send, rate, target) : null;
  const limits = currentLimits();
  const overLimit = send.amount > limits.perSend.amount;
  const ready = send.amount > 0n && rate !== null && !overLimit;

  const separator =
    new Intl.NumberFormat(LOCALES[language]).formatToParts(1.1).find((p) => p.type === "decimal")?.value ??
    ".";

  const handleContinue = () => {
    if (rate === null) return;
    setQuote(buildQuote(send, rate, target));
    router.push("/send/review");
  };

  return (
    <Screen
      title={t("sendFlow.step2.title")}
      backLabel={t("common.back")}
      step={{ current: 2, total: 3 }}
      footer={
        <Button onClick={handleContinue} disabled={!ready}>
          {t("sendFlow.step2.continue")}
        </Button>
      }
    >
      <Card>
        <ListRow
          leading={<Avatar name={displayName(contact)} />}
          title={contact.name}
          subtitle={`${countryName(contact.country, language)} · ${contact.payout.reference}`}
          trailing={
            <span style={typography.body3} className="shrink-0 text-text-secondary">
              {t("sendFlow.step2.change")}
            </span>
          }
          onClick={() => router.replace("/send")}
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
                  rate: new Intl.NumberFormat(LOCALES[language], { maximumFractionDigits: 2 }).format(
                    rate ?? 0
                  ),
                  to: target,
                })}
        </p>

        <p style={typography.body3} className="mt-4 text-text-tertiary">
          {t("sendFlow.step2.receives", { name: displayName(contact) })}
        </p>
        <p style={typography.heading1} className="mt-0.5">
          {receive ? format(receive) : "—"}
        </p>
      </Card>

      {overLimit && (
        <p style={typography.body4} className="mt-3 text-danger">
          {t("sendFlow.step2.overLimit", { limit: format(limits.perSend) })}
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
