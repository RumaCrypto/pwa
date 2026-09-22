"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Fingerprint } from "lucide-react";
import { OTPInput, SlotProps } from "input-otp";
import clsx from "clsx";
import { usePrivy, useLoginWithEmail, useLoginWithPasskey, useSignupWithPasskey, useCreateWallet } from "@privy-io/react-auth";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { typography } from "@/constants/typography";

type Step = "method" | "email" | "code";

const PASSKEY_ACCOUNT_EXISTS_KEY = 'privy_passkey_account_exists';

export default function LoginMethodStep() {
  const { t } = useI18n();
  const router = useRouter();
  const { user, authenticated } = usePrivy();
  const { sendCode, loginWithCode, state: emailState } = useLoginWithEmail();
  const { loginWithPasskey, state: passkeyState } = useLoginWithPasskey();
  const { signupWithPasskey, state: signupPasskeyState } = useSignupWithPasskey();
  const { createWallet } = useCreateWallet();

  const [step, setStep] = useState<Step>("method");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hasPasskeyAccount, setHasPasskeyAccount] = useState<boolean | null>(null);

  useEffect(() => {
    if (authenticated) router.replace("/home");
  }, [authenticated, router]);

  useEffect(() => {
    const loadPasskeyStatus = () => {
      try {
        const exists = localStorage.getItem(PASSKEY_ACCOUNT_EXISTS_KEY);
        setHasPasskeyAccount(exists === 'true');
      } catch (error) {
        console.error('Failed to load passkey status:', error);
        setHasPasskeyAccount(false);
      }
    };
    loadPasskeyStatus();
  }, []);

  const handlePasskey = async () => {
    setError(null);
    try {
      if (hasPasskeyAccount) {
        // User has existing passkey, login
        await loginWithPasskey();
      } else {
        // First time, signup
        await signupWithPasskey();
        // Mark that passkey account now exists
        localStorage.setItem(PASSKEY_ACCOUNT_EXISTS_KEY, 'true');
        setHasPasskeyAccount(true);
      }
      
      let wallet = user?.wallet;
      if (!wallet) {
        wallet = await createWallet();
      }
    } catch {
      setError(t("onboarding.liveness.error"));
    }
  };

  const handleSendCode = async () => {
    setError(null);
    try {
      await sendCode({ email });
      setStep("code");
    } catch {
      setError(t("onboarding.liveness.error"));
    }
  };

  const handleVerifyCode = async () => {
    setError(null);
    try {
      await loginWithCode({ code });
      let wallet = user?.wallet;
      if (!wallet) {
        console.log("no wallet, creating")
        wallet = await createWallet();
      }
    } catch {
      setError(t("onboarding.liveness.error"));
    }
  };

  const emailBusy = emailState.status === "sending-code" || emailState.status === "submitting-code";
  const passkeyBusy =
    passkeyState.status === "generating-challenge" ||
    passkeyState.status === "awaiting-passkey" ||
    passkeyState.status === "submitting-response";

  const signupPasskeyBusy =
    signupPasskeyState.status === "generating-challenge" ||
    signupPasskeyState.status === "awaiting-passkey" ||
    signupPasskeyState.status === "submitting-response";

  return (
    <div className="flex flex-1 flex-col justify-between px-6 pb-8 pt-16">
      <div className="flex flex-1 flex-col justify-center gap-6">
        {step === "method" && (
          <>
            <div>
              <h1 style={typography.display3} className="mb-2">
                {t("onboarding.loginMethod.title")}
              </h1>
              <p style={typography.body1} className="text-text-secondary">
                {t("onboarding.loginMethod.subtitle")}
              </p>
            </div>
          </>
        )}

        {step === "email" && (
          <>
            <div>
              <h1 style={typography.display3} className="mb-2">
                {t("onboarding.email.title")}
              </h1>
              <p style={typography.body1} className="text-text-secondary">
                {t("onboarding.email.description")}
              </p>
            </div>
            <Input
              type="email"
              inputMode="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("onboarding.email.placeholder")}
            />
          </>
        )}

        {step === "code" && (
          <>
            <div>
              <h1 style={typography.display3} className="mb-2">
                {t("onboarding.verify.title")}
              </h1>
              <p style={typography.body1} className="text-text-secondary">
                {t("onboarding.verify.description")}
              </p>
            </div>
            <OTPInput
              maxLength={6}
              value={code}
              onChange={setCode}
              autoFocus
              containerClassName="flex justify-between gap-2"
              render={({ slots }) => (
                <>
                  {slots.map((slot, idx) => (
                    <OtpSlot key={idx} {...slot} />
                  ))}
                </>
              )}
            />
          </>
        )}

        {error && (
          <p style={typography.body3} className="text-danger">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {step === "method" && (
          <>
            <Button onClick={() => setStep("email")}>
              <Mail size={20} />
              {t("onboarding.loginMethod.emailButton")}
            </Button>
            <Button 
              variant="secondary" 
              onClick={handlePasskey} 
              disabled={hasPasskeyAccount === null || passkeyBusy || signupPasskeyBusy}
            >
              <Fingerprint size={20} />
              {t("onboarding.loginMethod.passkeyButton")}
            </Button>
          </>
        )}
        {step === "email" && (
          <Button onClick={handleSendCode} disabled={!email || emailBusy}>
            {t("onboarding.email.login")}
          </Button>
        )}
        {step === "code" && (
          <Button onClick={handleVerifyCode} disabled={code.length < 6 || emailBusy}>
            {t("onboarding.verify.button")}
          </Button>
        )}
      </div>
    </div>
  );
}

function OtpSlot({ char, isActive }: SlotProps) {
  return (
    <div
      style={typography.heading2}
      className={clsx(
        "flex h-14 flex-1 items-center justify-center rounded-xl border bg-white",
        isActive ? "border-primary" : "border-border-light"
      )}
    >
      {char}
    </div>
  );
}
