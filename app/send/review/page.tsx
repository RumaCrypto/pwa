"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { ListRow } from "@/components/ui/list-row";
import { DetailRow } from "@/components/ui/detail-row";
import { Callout } from "@/components/ui/callout";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { LOCALES } from "@/lib/i18n/languages";
import { useContacts } from "@/lib/contacts/contacts-context";
import { countryName, displayName } from "@/lib/contacts/contacts";
import { useSend } from "@/lib/send/send-context";
import { useMoney } from "@/lib/money/money-context";
import { isExpired } from "@/lib/send/quote";

export default function SendReviewStep() {
  const router = useRouter();
  const { t, language } = useI18n();
  const { findContact, loaded } = useContacts();
  const { contactId, quote, placeOrder, reset } = useSend();
  const { format } = useMoney();

  const contact = contactId ? findContact(contactId) : undefined;
  const [expired, setExpired] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // `submitting` matters because placing the order clears the draft, which
    // would otherwise trip this guard and bounce back to step one mid-navigation.
    if (loaded && !submitting && (!contact || !quote)) router.replace("/send");
  }, [loaded, submitting, contact, quote, router]);

  // The locked rate is a promise to the recipient, so the screen has to notice
  // when it lapses rather than sending at a stale number.
  useEffect(() => {
    if (!quote) return;
    const tick = () => setExpired(isExpired(quote));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [quote]);

  if (!contact || !quote) return null;

  const name = displayName(contact);

  const handleSend = () => {
    setSubmitting(true);
    const order = placeOrder(quote, contact.id);
    reset();
    router.replace(`/send/${order.id}`);
  };

  return (
    <Screen
      title={t("sendFlow.step3.title")}
      backLabel={t("common.back")}
      step={{ current: 3, total: 3 }}
      footer={
        <>
          <Button variant="black" onClick={handleSend} disabled={expired}>
            {t("sendFlow.step3.send", { amount: format(quote.total) })}
          </Button>
          <p style={typography.body5} className="mt-3 text-center text-text-secondary">
            {t("sendFlow.step3.legal")}
          </p>
        </>
      }
    >
      <Card>
        <ListRow
          leading={<Avatar name={name} />}
          title={contact.name}
          subtitle={`${contact.payout.reference} · ${countryName(contact.country, language)}`}
          chevron
          onClick={() => router.replace("/send")}
        />
      </Card>

      <Card className="mt-4 px-5 py-3">
        <DetailRow label={t("sendFlow.step3.youSend")} value={format(quote.send)} />
        <DetailRow label={t("sendFlow.step3.cost")} value={format(quote.fee)} />
        <DetailRow label={t("sendFlow.step3.total")} value={format(quote.total)} emphasis />

        <div className="my-2 border-t border-border-light" />

        <DetailRow
          label={t("sendFlow.step3.rate")}
          value={new Intl.NumberFormat(LOCALES[language], { maximumFractionDigits: 2 }).format(quote.rate)}
        />
        <DetailRow
          label={t("sendFlow.step3.receives", { name })}
          // Symbol and code together read as "R$256,04 BRL"; the designs show the code alone.
          value={`${format(quote.receive, { symbol: false })} ${quote.receive.currency}`}
          emphasis
        />
        <DetailRow label={t("sendFlow.step3.arrives")} value={t("sendFlow.step3.arrivesValue")} />
      </Card>

      <Callout className="mt-4">
        {expired ? t("sendFlow.step3.expired") : t("sendFlow.step3.lockNote", { name })}
      </Callout>
    </Screen>
  );
}
