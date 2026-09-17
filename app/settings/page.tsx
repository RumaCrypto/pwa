"use client";

import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useI18n } from "@/lib/i18n/i18n-context";
import { LANGUAGES, type Language } from "@/lib/i18n/languages";
import { useMoney } from "@/lib/money/money-context";
import { CURRENCIES, CURRENCY_CODES } from "@/lib/money/currencies";
import { fromNumber } from "@/lib/money/money";
import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { Callout } from "@/components/ui/callout";
import { typography } from "@/constants/typography";

export default function SettingsPage() {
  const { t, language, setLanguage } = useI18n();
  const { displayCurrency, setDisplayCurrency, format } = useMoney();
  const { logout } = usePrivy();
  const router = useRouter();

  const handleSignOut = async () => {
    await logout();
    router.replace("/onboarding");
  };

  return (
    <Screen title={t("settings")} backLabel={t("common.back")}>
      <Section title={t("settings.selectLanguage")}>
        <Card divided>
          {LANGUAGES.map((lang) => (
            <ListRow
              key={lang}
              title={t(`settings.language.${lang}` as `settings.language.${Language}`)}
              selected={lang === language}
              onClick={() => setLanguage(lang)}
            />
          ))}
        </Card>
      </Section>

      <Section title={t("settings.selectCurrency")} hint={t("settings.currencyHint")}>
        <Card divided>
          {CURRENCY_CODES.map((code) => (
            <ListRow
              key={code}
              title={code}
              leading={
                <span style={typography.label1} className="w-7 text-text-secondary">
                  {CURRENCIES[code].symbol}
                </span>
              }
              selected={code === displayCurrency}
              onClick={() => setDisplayCurrency(code)}
            />
          ))}
        </Card>
      </Section>

      <Callout title={t("tabs.home.balance")}>{format(fromNumber(1080.5, displayCurrency))}</Callout>

      <Section title={t("settings.security")}>
        <Card divided>
          <ListRow title={t("settings.signOut")} className="text-danger" onClick={handleSignOut} />
        </Card>
      </Section>
    </Screen>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 style={typography.caption2} className="mb-3 uppercase text-text-secondary">
        {title}
      </h2>
      {hint && (
        <p style={typography.body4} className="mb-3 text-text-secondary">
          {hint}
        </p>
      )}
      {children}
    </section>
  );
}
