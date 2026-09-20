"use client";

import { useRouter } from "next/navigation";

import { Screen } from "@/components/ui/screen";
import { Callout } from "@/components/ui/callout";
import { Button } from "@/components/ui/button";
import { typography } from "@/constants/typography";
import { useI18n } from "@/lib/i18n/i18n-context";

/**
 * Stands in for the whole card flow while `FLAGS.card` is off. Says the card is
 * not ready instead of walking someone through a setup that cannot issue one.
 */
export function CardUnavailable() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <Screen
      title={t("card.title")}
      backLabel={t("common.back")}
      footer={
        <Button variant="secondary" onClick={() => router.back()}>
          {t("common.back")}
        </Button>
      }
    >
      <h2 style={typography.display3} className="mb-4">
        {t("card.unavailable")}
      </h2>
      <Callout>{t("card.unavailable.hint")}</Callout>
    </Screen>
  );
}
