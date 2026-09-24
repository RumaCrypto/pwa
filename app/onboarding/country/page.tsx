"use client";

import { useRouter } from "next/navigation";

import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { COUNTRIES, countryName } from "@/lib/contacts/contacts";
import { useResidency } from "@/lib/settings/residency-context";

export default function OnboardingCountryStep() {
  const router = useRouter();
  const { t, language } = useI18n();
  const { setCountry } = useResidency();

  const choose = (country: string) => {
    setCountry(country);
    router.replace("/home");
  };

  return (
    <Screen title={t("onboarding.country.title")}>
      <p style={typography.body1} className="mb-6 text-text-secondary">
        {t("onboarding.country.subtitle")}
      </p>

      <Card divided>
        {COUNTRIES.map((code) => (
          <ListRow key={code} title={countryName(code, language)} chevron onClick={() => choose(code)} />
        ))}
      </Card>
    </Screen>
  );
}
