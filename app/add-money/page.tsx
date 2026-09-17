"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { RadioCard } from "@/components/ui/radio-card";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { ADD_METHODS, defaultMethod, enabledMethods, isAdvanced, type CashflowMethod } from "@/lib/cashflow/methods";

export default function AddMoneyScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [method, setMethod] = useState<CashflowMethod>(defaultMethod(ADD_METHODS));
  const methods = enabledMethods(ADD_METHODS);

  return (
    <Screen
      title={t("cashflow.add.title")}
      backLabel={t("common.back")}
      footer={
        <Button variant="black" onClick={() => router.push(`/add-money/${method}`)}>
          {t("cashflow.continue")}
        </Button>
      }
    >
      <h2 style={typography.display3} className="mb-6">
        {t("cashflow.add.question")}
      </h2>

      <div role="radiogroup" className="flex flex-col gap-3">
        {methods.map((option) => (
          <RadioCard
            key={option}
            title={t(`cashflow.add.${option}` as "cashflow.add.bank")}
            description={t(`cashflow.add.${option}Hint` as "cashflow.add.bankHint")}
            tag={isAdvanced(option) ? t("cashflow.advanced") : undefined}
            selected={option === method}
            onSelect={() => setMethod(option)}
          />
        ))}
      </div>
    </Screen>
  );
}
