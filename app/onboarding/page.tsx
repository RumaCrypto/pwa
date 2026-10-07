"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { LanguagePicker } from "@/components/ui/language-picker";
import { RumaLogo } from "@/components/ui/ruma-logo";
import { OnboardingCarousel, type OnboardingSlide } from "@/components/onboarding/onboarding-carousel";
import {
  SendMoneyIllustration,
  QrIllustration,
  WalletIllustration,
} from "@/components/onboarding/illustrations";
import { typography } from "@/constants/typography";

export default function OnboardingWelcome() {
  const { t } = useI18n();
  const router = useRouter();

  const goToLogin = () => router.push("/onboarding/login");

  const slides: OnboardingSlide[] = [
    {
      illustration: <SendMoneyIllustration className="h-full w-full" />,
      title: t("onboarding.welcome.slide1.title"),
      line: t("onboarding.welcome.slide1.line"),
    },
    {
      illustration: <QrIllustration className="h-full w-full" />,
      title: t("onboarding.welcome.slide2.title"),
      line: t("onboarding.welcome.slide2.line"),
    },
    {
      illustration: <WalletIllustration className="h-full w-full" />,
      title: t("onboarding.welcome.slide3.title"),
      line: t("onboarding.welcome.slide3.line"),
    },
  ];

  return (
    <div
      className="flex min-h-dvh flex-col pb-8"
      style={{ background: "linear-gradient(180deg, #e8f0ff 0%, #f3f6ff 42%, #fafafa 100%)" }}
    >
      <div className="flex items-center justify-between pl-6 pr-18 pt-6">
        <RumaLogo />
        <LanguagePicker />
      </div>

      <OnboardingCarousel slides={slides} />

      <div className="mt-8 flex flex-col items-center gap-3 px-6">
        <Button onClick={goToLogin}>{t("onboarding.welcome.startbutton")}</Button>
        <button
          onClick={goToLogin}
          style={typography.label1}
          className="py-2 text-text active:opacity-60"
        >
          {t("onboarding.welcome.login")}
        </button>
      </div>
    </div>
  );
}
