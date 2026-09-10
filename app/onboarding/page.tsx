"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { typography } from "@/constants/typography";

export default function OnboardingWelcome() {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <div className="flex flex-1 flex-col justify-between px-6 pb-8 pt-16">
      <div className="flex flex-1 flex-col justify-center">
        <h1 style={typography.display3} className="mb-2">
          {t("onboarding.welcome.title")}
        </h1>
        <p style={typography.body1} className="text-text-secondary">
          {t("onboarding.welcome.description")}
        </p>
      </div>
      <Button onClick={() => router.push("/onboarding/login")}>
        {t("onboarding.welcome.startbutton")}
      </Button>
    </div>
  );
}
