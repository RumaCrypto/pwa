"use client";

import { useState } from "react";
import { ArrowUpRight, CreditCard, Gauge, QrCode, Wallet } from "lucide-react";

import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { Callout } from "@/components/ui/callout";
import { Button } from "@/components/ui/button";
import { Timeline } from "@/components/ui/timeline";
import { DetailRow } from "@/components/ui/detail-row";
import { AccordionItem } from "@/components/ui/accordion";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { LOCALES } from "@/lib/i18n/languages";
import { useMoney } from "@/lib/money/money-context";
import { fromNumber } from "@/lib/money/money";
import { STAGES } from "@/lib/send/orders";
import { FEE_RATE } from "@/lib/send/quote";
import { PAY_FEE_RATE } from "@/lib/pay/payments";
import { WITHDRAW_FEE } from "@/lib/cashflow/methods";

const TOPICS = [
  { key: "send", Icon: ArrowUpRight },
  { key: "qr", Icon: QrCode },
  { key: "money", Icon: Wallet },
  { key: "card", Icon: CreditCard },
  { key: "limits", Icon: Gauge },
] as const;

const FAQS = [1, 2, 3, 4, 5, 6] as const;

export default function HelpScreen() {
  const { t } = useI18n();

  return (
    <Screen title={t("help.title")} backLabel={t("common.back")}>
      <h2 style={typography.display3}>{t("help.hero.title")}</h2>
      <p style={typography.body1} className="mt-3 text-text-secondary">
        {t("help.hero.body")}
      </p>

      <TransferWalkthrough />

      <Section title={t("help.topics.title")}>
        <Card divided>
          {TOPICS.map(({ key, Icon }) => (
            <AccordionItem
              key={key}
              title={t(`help.topic.${key}` as "help.topic.send")}
              leading={
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary-dark">
                  <Icon size={16} />
                </span>
              }
            >
              {t(`help.topic.${key}Body` as "help.topic.sendBody")}
            </AccordionItem>
          ))}
        </Card>
      </Section>

      <Costs />

      <Section title={t("help.faq.title")}>
        <Card divided>
          {FAQS.map((n) => (
            <AccordionItem key={n} title={t(`help.faq.q${n}` as "help.faq.q1")}>
              {t(`help.faq.a${n}` as "help.faq.a1")}
            </AccordionItem>
          ))}
        </Card>
      </Section>

      <Callout className="mt-8" title={t("help.contact.title")}>
        {t("help.contact.body")}
      </Callout>
    </Screen>
  );
}

/**
 * Walks the same four stages the tracking screen shows, using the same copy, so
 * what the help explains cannot drift from what the product does.
 */
function TransferWalkthrough() {
  const { t } = useI18n();
  const { format } = useMoney();
  const [reached, setReached] = useState(0);
  const name = t("help.how.example");
  const amount = format(fromNumber(EXAMPLE.amount, "USD"));
  const done = reached >= STAGES.length - 1;

  return (
    <Section title={t("help.how.title")}>
      <Card className="px-5 py-5">
        <Timeline
          steps={STAGES.map((stage, index) => ({
            title:
              stage === "paying" || stage === "delivered"
                ? t(`sendFlow.stage.${stage}`, { name })
                : t(`sendFlow.stage.${stage}`),
            subtitle: index <= reached ? stageHint(stage, t, amount) : undefined,
            state: index < reached ? "done" : index === reached ? "current" : "pending",
          }))}
        />

        <Button
          variant="secondary"
          className="mt-5"
          onClick={() => setReached(done ? 0 : reached + 1)}
        >
          {done ? t("help.how.replay") : t("help.how.next")}
        </Button>

        {reached === 0 && (
          <p style={typography.body5} className="mt-3 text-center text-text-secondary">
            {t("help.how.hint")}
          </p>
        )}
      </Card>
    </Section>
  );
}

/** Example figures, so the walkthrough is concrete without inventing new copy. */
const EXAMPLE = { amount: 50.3, rate: "5,12" };

function stageHint(
  stage: (typeof STAGES)[number],
  t: ReturnType<typeof useI18n>["t"],
  amount: string
): string {
  if (stage === "funded") return t("sendFlow.stage.fundedHint", { amount });
  if (stage === "converted") return t("sendFlow.stage.convertedHint", { rate: EXAMPLE.rate });
  if (stage === "paying") return t("sendFlow.stage.payingHint");
  return t("sendFlow.stage.deliveredHint");
}

/** Reads the live fee constants, so the help cannot quote a price that changed. */
function Costs() {
  const { t, language } = useI18n();
  const { format } = useMoney();
  const percent = (rate: number) =>
    `${new Intl.NumberFormat(LOCALES[language], { maximumFractionDigits: 2 }).format(rate * 100)}% ${t("help.costs.ofAmount")}`;

  return (
    <Section title={t("help.costs.title")}>
      <Card className="px-5 py-3">
        <DetailRow label={t("help.costs.send")} value={percent(FEE_RATE)} />
        <DetailRow label={t("help.costs.pay")} value={percent(PAY_FEE_RATE)} />
        <DetailRow label={t("help.costs.withdraw")} value={format(WITHDRAW_FEE)} />
        <DetailRow label={t("help.costs.receive")} value={t("help.costs.free")} />
      </Card>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h3 style={typography.heading3} className="mb-3">
        {title}
      </h3>
      {children}
    </section>
  );
}
