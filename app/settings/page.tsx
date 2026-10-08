"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useI18n } from "@/lib/i18n/i18n-context";
import { LANGUAGES, type Language } from "@/lib/i18n/languages";
import { useMoney } from "@/lib/money/money-context";
import { CURRENCIES, CURRENCY_CODES } from "@/lib/money/currencies";
import { fromNumber } from "@/lib/money/money";
import { COUNTRIES, countryName } from "@/lib/contacts/contacts";
import { useResidency } from "@/lib/settings/residency-context";
import { useUsername } from "@/lib/settings/use-username";
import { USERNAME_MAX_LENGTH, emailName, normalizeUsername } from "@/lib/settings/username";
import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { Callout } from "@/components/ui/callout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { typography } from "@/constants/typography";

export default function SettingsPage() {
  const { t, language, setLanguage } = useI18n();
  const { displayCurrency, setDisplayCurrency, format } = useMoney();
  const { country: residencyCountry, setCountry: setResidencyCountry } = useResidency();
  const { logout } = usePrivy();
  const router = useRouter();

  const handleSignOut = async () => {
    await logout();
    router.replace("/onboarding");
  };

  return (
    <Screen title={t("settings")} backLabel={t("common.back")}>
      <UsernameSection />

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

      <Section title={t("settings.selectCountry")} hint={t("settings.countryHint")}>
        <Card divided>
          {COUNTRIES.map((code) => (
            <ListRow
              key={code}
              title={countryName(code, language)}
              selected={code === residencyCountry}
              onClick={() => setResidencyCountry(code)}
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

      <Section title={t("settings.security")}>
        <Card divided>
          <ListRow title={t("settings.signOut")} className="text-danger" onClick={handleSignOut} />
        </Card>
      </Section>
    </Screen>
  );
}

function UsernameSection() {
  const { t } = useI18n();
  const { username, email, setUsername } = useUsername();
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       The stored name is read after mount; mirror it into the field once known. */
    setDraft(username ?? "");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [username]);

  const unchanged = normalizeUsername(draft) === username;

  const save = () => {
    setUsername(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Section title={t("settings.username")} hint={t("settings.usernameHint")}>
      <div className="flex gap-2">
        <Input
          className="min-w-0 flex-1"
          maxLength={USERNAME_MAX_LENGTH}
          placeholder={emailName(email) ?? t("settings.usernamePlaceholder")}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setSaved(false);
          }}
        />
        <div className="w-28 shrink-0">
          <Button variant="black" onClick={save} disabled={unchanged}>
            {saved ? t("settings.usernameSaved") : t("settings.usernameSave")}
          </Button>
        </div>
      </div>
    </Section>
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
