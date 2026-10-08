"use client";

import { notFound, useParams } from "next/navigation";

import { useI18n } from "@/lib/i18n/i18n-context";
import { ADD_METHODS, isAvailable, type CashflowMethod } from "@/lib/cashflow/methods";
import { UnavailableMethod } from "@/components/cashflow/unavailable-method";

/** Bank and wallet have their own routes, which win over this one; only methods still waiting on a provider land here. */
export default function AddMoneyMethodScreen() {
  const { method } = useParams<{ method: CashflowMethod }>();
  const { t } = useI18n();

  if (!ADD_METHODS.includes(method) || isAvailable(method)) notFound();

  return <UnavailableMethod method={method} title={t("cashflow.add.title")} />;
}
