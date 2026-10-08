"use client";

import { useParams } from "next/navigation";

import { useI18n } from "@/lib/i18n/i18n-context";
import type { CashflowMethod } from "@/lib/cashflow/methods";
import { UnavailableMethod } from "@/components/cashflow/unavailable-method";

/** Bank and wallet have their own routes; whatever reaches here is not available yet. */
export default function WithdrawMethodScreen() {
  const { method } = useParams<{ method: CashflowMethod }>();
  const { t } = useI18n();

  return <UnavailableMethod method={method} title={t("cashflow.out.title")} />;
}
