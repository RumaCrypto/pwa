"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { LanguagePicker } from "@/components/ui/language-picker";
import { typography } from "@/constants/typography";

export default function OnboardingWelcome() {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <Screen
      className="justify-center pt-16"
      footer={
        <Button onClick={() => router.push("/onboarding/login")}>
          {t("onboarding.welcome.startbutton")}
        </Button>
      }
    >
      <div className="absolute right-6 top-6">
        <LanguagePicker />
      </div>
      <h1 style={typography.display3} className="mb-2">
        {t("onboarding.welcome.title")}
      </h1>
      <p style={typography.body1} className="text-text-secondary">
        {t("onboarding.welcome.description")}
      </p>
    </Screen>
  );
}
