"use client";

import { useParams } from "next/navigation";

import { useI18n } from "@/lib/i18n/i18n-context";
import { isAvailable, type CashflowMethod } from "@/lib/cashflow/methods";
import { UnavailableMethod } from "@/components/cashflow/unavailable-method";
import { SendToWallet } from "@/components/cashflow/send-to-wallet";

export default function WithdrawMethodScreen() {
  const { method } = useParams<{ method: CashflowMethod }>();
  const { t } = useI18n();

  if (!isAvailable(method)) {
    return <UnavailableMethod method={method} title={t("cashflow.out.title")} />;
  }
  return <SendToWallet />;
}
