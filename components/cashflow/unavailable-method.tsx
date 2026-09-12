"use client";

import { useRouter } from "next/navigation";

import { Screen } from "@/components/ui/screen";
import { Callout } from "@/components/ui/callout";
import { Button } from "@/components/ui/button";
import { typography } from "@/constants/typography";
import { useI18n } from "@/lib/i18n/i18n-context";
import type { CashflowMethod } from "@/lib/cashflow/methods";

/**
 * Says plainly which provider a route is waiting on instead of showing a flow
 * that cannot complete.
 */
export function UnavailableMethod({ method, title }: { method: CashflowMethod; title: string }) {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <Screen
      title={title}
      backLabel={t("common.back")}
      footer={
        <Button variant="secondary" onClick={() => router.back()}>
          {t("common.back")}
        </Button>
      }
    >
      <h2 style={typography.display3} className="mb-4">
        {t("cashflow.unavailable")}
      </h2>
      <Callout>
        {method === "bank" ? t("cashflow.unavailable.bank") : t("cashflow.unavailable.cash")}
      </Callout>
    </Screen>
  );
}
