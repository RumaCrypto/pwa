"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListRow } from "@/components/ui/list-row";
import { DetailRow } from "@/components/ui/detail-row";
import { Callout } from "@/components/ui/callout";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { LOCALES } from "@/lib/i18n/languages";
import { useResidency } from "@/lib/settings/residency-context";
import { countryName, formatLocalPayoutReference, localPayoutLabel, packLocalPayoutReference } from "@/lib/contacts/contacts";
import { useWithdraw } from "@/lib/withdraw/withdraw-context";
import { useMoney } from "@/lib/money/money-context";
import { isExpired } from "@/lib/send/quote";
import { useP2pWalletClient } from "@/hooks/use-p2p-wallet-client";

export default function WithdrawReviewStep() {
  const router = useRouter();
  const { t, language } = useI18n();
  const { country, loaded } = useResidency();
  const { details, quote, placeOrder, reset } = useWithdraw();
  const { format } = useMoney();
  const getWalletClient = useP2pWalletClient();

  const [expired, setExpired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasDetails = Object.keys(details).length > 0;

  useEffect(() => {
    // `submitting` matters because placing the order clears the draft, which
    // would otherwise trip this guard and bounce back mid-navigation.
    if (loaded && !submitting && (!country || !hasDetails || !quote)) router.replace("/withdraw/bank");
  }, [loaded, submitting, country, hasDetails, quote, router]);

  // The locked rate is a promise, so the screen has to notice when it lapses.
  useEffect(() => {
    if (!quote) return;
    const tick = () => setExpired(isExpired(quote));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [quote]);

  if (!country || !hasDetails || !quote) return null;

  const payoutReference = packLocalPayoutReference(country, details);

  const handleWithdraw = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const { walletClient, address } = await getWalletClient();
      const order = await placeOrder({ quote, country, payoutReference, walletClient, userAddress: address });
      reset();
      router.replace(`/withdraw/bank/${order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <Screen
      title={t("withdrawFlow.review.title")}
      backLabel={t("common.back")}
      step={{ current: 3, total: 3 }}
      footer={
        <>
          <Button variant="black" onClick={handleWithdraw} disabled={expired || submitting}>
            {submitting ? t("sendFlow.step3.placing") : t("withdrawFlow.review.confirm", { amount: format(quote.total) })}
          </Button>
          {error && (
            <p style={typography.body5} className="mt-3 text-center text-danger">
              {t("sendFlow.step3.orderFailed", { error })}
            </p>
          )}
          <p style={typography.body5} className="mt-3 text-center text-text-secondary">
            {t("withdrawFlow.review.legal")}{" "}
            <a href="https://www.p2p.lol/tnc" target="_blank" className="font-bold">
              {t("common.terms")}
            </a>
          </p>
        </>
      }
    >
      <Card>
        <ListRow
          title={localPayoutLabel(country) ?? ""}
          subtitle={`${countryName(country, language)} · ${formatLocalPayoutReference(country, payoutReference, language)}`}
          chevron
          onClick={() => router.replace("/withdraw/bank")}
        />
      </Card>

      <Card className="mt-4 px-5 py-3">
        <DetailRow label={t("withdrawFlow.review.youWithdraw")} value={format(quote.send)} />
        <DetailRow label={t("sendFlow.step3.cost")} value={format(quote.fee)} />
        <DetailRow label={t("sendFlow.step3.total")} value={format(quote.total)} emphasis />

        <div className="my-2 border-t border-border-light" />

        <DetailRow
          label={t("sendFlow.step3.rate")}
          value={new Intl.NumberFormat(LOCALES[language], { maximumFractionDigits: 2 }).format(quote.rate)}
        />
        <DetailRow
          label={t("withdrawFlow.review.youReceive")}
          value={`${format(quote.receive, { symbol: false })} ${quote.receive.currency}`}
          emphasis
        />
        <DetailRow label={t("sendFlow.step3.arrives")} value={t("sendFlow.step3.arrivesValue")} />
      </Card>

      <Callout className="mt-4">{expired ? t("sendFlow.step3.expired") : t("withdrawFlow.review.lockNote")}</Callout>
    </Screen>
  );
}
