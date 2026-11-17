"use client";

import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { DetailRow } from "@/components/ui/detail-row";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { useResidency } from "@/lib/settings/residency-context";
import { usePriceQuote } from "@/lib/price/use-price-quote";
import type { PriceSide } from "@/lib/price/price-quote";
import { formatPrice } from "./format-price";

/** Today's buy or sell price, whether it is a good one, and why it moves. */
export function PriceScreen({ side }: { side: PriceSide }) {
  const { t, language } = useI18n();
  const { country, loaded } = useResidency();
  const { supported, quote, loading } = usePriceQuote(side);

  if (!loaded) return null;

  const fmt = (value: number) => (quote ? formatPrice(value, quote.currency, language) : "-");

  return (
    <Screen title={t(`price.${side}.title`)} backLabel={t("common.back")}>
      {!country || !supported ? (
        <p style={typography.body3} className="text-text-secondary">
          {t("price.needsCountry")}
        </p>
      ) : (
        <>
          <p style={typography.body3} className="text-text-tertiary">
            {t(`price.${side}.label`)}
          </p>
          <p style={typography.display3} className="mt-1">
            {quote ? fmt(quote.price) : "-"}
          </p>
          {quote ? (
            <p style={typography.label3} className={`mt-2 ${quote.good ? "text-success" : "text-danger"}`}>
              {t(quote.good ? `price.${side}.good` : `price.${side}.notGood`)}
            </p>
          ) : (
            !loading && (
              <p style={typography.body4} className="mt-2 text-text-secondary">
                {t("price.unavailable")}
              </p>
            )
          )}

          <Card className="mt-6 px-5 py-3">
            <DetailRow label={t("price.market")} value={quote ? fmt(quote.market) : "-"} />
            <DetailRow
              label={t("price.goodRange")}
              value={quote ? `${fmt(quote.range.min)} – ${fmt(quote.range.max)}` : "-"}
            />
          </Card>

          <h3 style={typography.heading3} className="mb-1 mt-8">
            {t("price.whatIsGood")}
          </h3>
          <p style={typography.body3} className="text-text-secondary">
            {t(`price.${side}.whatIsGoodBody`, {
              min: quote ? fmt(quote.range.min) : "-",
              max: quote ? fmt(quote.range.max) : "-",
            })}
          </p>

          <h3 style={typography.heading3} className="mb-1 mt-8">
            {t("price.why")}
          </h3>
          <p style={typography.body3} className="text-text-secondary">
            {t("price.whyBody")}
          </p>
        </>
      )}
    </Screen>
  );
}
