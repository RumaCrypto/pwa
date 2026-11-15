"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { typography } from "@/constants/typography";
import { useI18n } from "@/lib/i18n/i18n-context";
import { usePriceQuote } from "@/lib/price/use-price-quote";
import type { PriceSide } from "@/lib/price/price-quote";
import { formatPrice } from "./format-price";

/** Today's USDC price for the user's country; taps through to the explanation. Hidden where there is no local price. */
export function PriceBadge({ side, href, className }: { side: PriceSide; href: string; className?: string }) {
  const router = useRouter();
  const { t, language } = useI18n();
  const { supported, quote } = usePriceQuote(side);

  if (!supported) return null;

  const price = quote ? formatPrice(quote.price, quote.currency, language) : "-";

  return (
    <button
      onClick={() => router.push(href)}
      className={`inline-flex items-center gap-2 rounded-full border border-border-light bg-white py-1.5 pl-3 pr-2 active:opacity-70 ${className ?? ""}`}
    >
      {quote?.good && <span aria-hidden className="h-2 w-2 rounded-full bg-success" />}
      <span style={typography.label3}>{t("price.badge", { price })}</span>
      {quote?.good && (
        <span style={typography.label3} className="text-success">
          {t("price.badgeGood")}
        </span>
      )}
      <ChevronRight size={16} className="text-text-tertiary" />
    </button>
  );
}
