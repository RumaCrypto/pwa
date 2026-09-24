"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DetailRow } from "@/components/ui/detail-row";
import { Callout } from "@/components/ui/callout";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { LOCALES } from "@/lib/i18n/languages";
import { useMoney } from "@/lib/money/money-context";
import { usePay } from "@/lib/pay/pay-context";
import { countryName } from "@/lib/contacts/contacts";
import { useLimits } from "@/lib/limits/limits-context";
import { useP2pWalletClient } from "@/hooks/use-p2p-wallet-client";

export default function PayReviewScreen() {
  const router = useRouter();
  const { t, language } = useI18n();
  const { quote, placeOrder, reset } = usePay();
  const { format } = useMoney();
  const { limits, recordCompletedSend } = useLimits();
  const getWalletClient = useP2pWalletClient();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // `submitting` matters because placing the order clears the quote, which
    // would otherwise trip this guard and bounce back to the amount step mid-navigation.
    if (!submitting && !quote) router.replace("/pay");
  }, [submitting, quote, router]);

  if (!quote) return null;

  const overLimit = quote.usdc.amount > limits.perSend.amount;

  const handleConfirm = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const { walletClient, address } = await getWalletClient();
      const order = await placeOrder({ quote, walletClient, userAddress: address });
      recordCompletedSend();
      reset();
      router.replace(`/pay/${order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <Screen
      title={t("payFlow.review.title")}
      backLabel={t("common.back")}
      step={{ current: 2, total: 2 }}
      footer={
        <>
          <Button variant="black" onClick={handleConfirm} disabled={submitting || overLimit}>
            {submitting ? t("payFlow.review.placing") : t("payFlow.review.confirm", { amount: format(quote.total) })}
          </Button>
          {error && (
            <p style={typography.body5} className="mt-3 text-center text-danger">
              {t("payFlow.review.orderFailed", { error })}
            </p>
          )}
          <p style={typography.body5} className="mt-3 text-center text-text-secondary">
            {t("payFlow.review.legal")}
          </p>
        </>
      }
    >
      <Card className="px-5 py-3">
        <DetailRow label={t("payFlow.review.paying")} value={format(quote.local)} emphasis />
        <DetailRow label={t("payFlow.review.country")} value={countryName(quote.country, language)} />
      </Card>

      <Card className="mt-4 px-5 py-3">
        <DetailRow label={t("payFlow.review.usdc")} value={format(quote.usdc)} />
        <DetailRow label={t("payFlow.review.cost")} value={format(quote.fee)} />
        <DetailRow label={t("payFlow.review.total")} value={format(quote.total)} emphasis />

        <div className="my-2 border-t border-border-light" />

        <DetailRow
          label={t("payFlow.review.rate")}
          value={`1 USDC = ${new Intl.NumberFormat(LOCALES[language], { maximumFractionDigits: 2 }).format(
            quote.rate
          )} ${quote.local.currency}`}
        />
      </Card>

      {overLimit && (
        <p style={typography.body4} className="mt-3 text-danger">
          {t("sendFlow.step2.overLimit", { limit: format(limits.perSend) })}
        </p>
      )}

      <Callout className="mt-4">{t("payFlow.review.hint")}</Callout>
    </Screen>
  );
}
