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
import { useDeposit } from "@/lib/deposit/deposit-context";
import { countryName, sdkCurrencyForCountry } from "@/lib/contacts/contacts";
import { getP2pOrders } from "@/lib/send/p2p-orders";
import { useLimits } from "@/lib/limits/limits-context";
import { useP2pWalletClient } from "@/hooks/use-p2p-wallet-client";
import { USDC_DECIMALS } from "@/lib/usdc";

/** Local currencies all use 2 decimals; p2p.me amounts are always 6-decimal bigints. */
const TO_SDK_SCALE = 10_000n;

export default function AddMoneyBankReviewScreen() {
  const router = useRouter();
  const { t, language } = useI18n();
  const { quote, placeOrder, reset } = useDeposit();
  const { format } = useMoney();
  const { limits, recordCompletedSend } = useLimits();
  const getWalletClient = useP2pWalletClient();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feeLabel, setFeeLabel] = useState<string>("...");

  useEffect(() => {
    // `submitting` matters because placing the order clears the quote, which
    // would otherwise trip this guard and bounce back to the amount step mid-navigation.
    if (!submitting && !quote) router.replace("/add-money/bank");
  }, [submitting, quote, router]);

  useEffect(() => {
    if (!quote) return;
    const currency = sdkCurrencyForCountry(quote.country);
    getP2pOrders()
      .getFeeConfig({ currency })
      .match(
        (cfg) => {
          const usdcAmount = quote.usdc.amount * TO_SDK_SCALE;
          if (usdcAmount > 0n && usdcAmount <= cfg.smallOrderThreshold) {
            const fee = Number(cfg.smallOrderFixedFee) / 10 ** USDC_DECIMALS;
            setFeeLabel(`$${fee.toFixed(2)} USDC`);
          } else {
            setFeeLabel(t("depositFlow.review.standardFee"));
          }
        },
        () => setFeeLabel(t("depositFlow.review.standardFee"))
      );
  }, [quote, t]);

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
      router.replace(`/add-money/bank/${order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <Screen
      title={t("depositFlow.review.title")}
      backLabel={t("common.back")}
      step={{ current: 2, total: 2 }}
      footer={
        <>
          <Button variant="black" onClick={handleConfirm} disabled={submitting || overLimit}>
            {submitting ? t("depositFlow.review.placing") : t("depositFlow.review.confirm", { amount: format(quote.local) })}
          </Button>
          {error && (
            <p style={typography.body5} className="mt-3 text-center text-danger">
              {t("depositFlow.review.orderFailed", { error })}
            </p>
          )}
          <p style={typography.body5} className="mt-3 text-center text-text-secondary">
            {t("depositFlow.review.legal")}
          </p>
        </>
      }
    >
      <Card className="px-5 py-3">
        <DetailRow label={t("depositFlow.review.paying")} value={format(quote.local)} emphasis />
        <DetailRow label={t("depositFlow.review.country")} value={countryName(quote.country, language)} />
      </Card>

      <Card className="mt-4 px-5 py-3">
        <DetailRow label={t("depositFlow.review.usdc")} value={format(quote.usdc)} emphasis />
        <DetailRow label={t("depositFlow.review.cost")} value={feeLabel} />

        <div className="my-2 border-t border-border-light" />

        <DetailRow
          label={t("depositFlow.review.rate")}
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

      <Callout className="mt-4">{t("depositFlow.review.hint")}</Callout>
    </Screen>
  );
}
