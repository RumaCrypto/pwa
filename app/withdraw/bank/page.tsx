"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Callout } from "@/components/ui/callout";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { useResidency } from "@/lib/settings/residency-context";
import {
  countryName,
  localPayoutFieldLabel,
  localPayoutFieldPlaceholder,
  localPayoutFields,
  localPayoutLabel,
  validateLocalPayoutFields,
} from "@/lib/contacts/contacts";
import { loadPayoutDetails, savePayoutDetails } from "@/lib/withdraw/payout-details";
import { useWithdraw } from "@/lib/withdraw/withdraw-context";

export default function WithdrawDetailsStep() {
  const router = useRouter();
  const { t, language } = useI18n();
  const { country, loaded } = useResidency();
  const { setDetails } = useWithdraw();

  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       Saved details live in localStorage, which only exists after mount. */
    if (country) setValues(loadPayoutDetails(country) ?? {});
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [country]);

  if (!loaded) return null;

  const methodLabel = country ? localPayoutLabel(country) : undefined;
  if (!country || !methodLabel) {
    return (
      <Screen title={t("cashflow.out.title")} backLabel={t("common.back")}>
        <h2 style={typography.display3} className="mb-4">
          {t("cashflow.unavailable")}
        </h2>
        <Callout>{t("withdrawFlow.details.noMethod")}</Callout>
      </Screen>
    );
  }

  const fields = localPayoutFields(country);

  const handleContinue = () => {
    const validationError = validateLocalPayoutFields(country, values);
    if (validationError) return setError(validationError);

    savePayoutDetails(country, values);
    setDetails(values);
    router.push("/withdraw/bank/amount");
  };

  return (
    <Screen
      title={t("withdrawFlow.details.title")}
      backLabel={t("common.back")}
      step={{ current: 1, total: 3 }}
      footer={<Button onClick={handleContinue}>{t("cashflow.continue")}</Button>}
    >
      <p style={typography.body3} className="mb-5 text-text-secondary">
        {t("withdrawFlow.details.subtitle", { method: methodLabel, country: countryName(country, language) })}
      </p>

      {fields.map((field) => (
        <div key={field.key} className="mb-5">
          <p style={typography.label3} className="mb-2">
            {localPayoutFieldLabel(country, field, language)}
          </p>
          <Input
            value={values[field.key] ?? ""}
            onChange={(event) => {
              setError(null);
              setValues((current) => ({ ...current, [field.key]: event.target.value }));
            }}
            placeholder={localPayoutFieldPlaceholder(country, field, language)}
          />
        </div>
      ))}

      {error && (
        <p style={typography.body3} className="text-danger">
          {error}
        </p>
      )}

      <Callout className="mt-2">{t("withdrawFlow.details.savedNote")}</Callout>
    </Screen>
  );
}
