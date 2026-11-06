"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import clsx from "clsx";

import { Screen } from "@/components/ui/screen";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import type { TranslationKey } from "@/lib/i18n/translations";
import { mainnetClient } from "@/lib/viem";
import { handleProblem, parseHandle, suggestHandle } from "@/lib/usernames/handle";
import { RUMA_REGISTRAR_ADDRESS, USERNAMES_ENABLED, chainReader } from "@/lib/usernames/registrar";
import { ClaimRequestError, requestClaim } from "@/lib/usernames/api";
import { useHandle } from "@/lib/usernames/use-handle";

type Availability = "idle" | "checking" | "available" | "taken" | "error";

/** Waiting on the availability check this long after the last keystroke keeps RPC calls down. */
const CHECK_DELAY_MS = 400;
/** A mainnet block is ~12s; past this the claim is reported as failed (it may still land, and home picks it up). */
const RECEIPT_TIMEOUT_MS = 180_000;

/**
 * Claims the user's ENS username. New users land here after picking their
 * country; existing users reach it from the home screen or Settings.
 */
export default function OnboardingUsernameStep() {
  const router = useRouter();
  const { t } = useI18n();
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const address = user?.wallet?.address;
  const email = user?.email?.address;
  const { handle, remember } = useHandle(address);

  const [draft, setDraft] = useState("");
  const [edited, setEdited] = useState(false);
  const [availability, setAvailability] = useState<Availability>("idle");
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = parseHandle(draft);
  const problem = label ? handleProblem(label) : null;

  useEffect(() => {
    if (ready && !authenticated) router.replace("/onboarding");
  }, [ready, authenticated, router]);

  // Nothing to claim without a registrar, and nothing to do for someone who already has a name.
  useEffect(() => {
    if (!USERNAMES_ENABLED || handle) router.replace("/home");
  }, [handle, router]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       The email arrives with the Privy user, after mount; only prefill an untouched field. */
    if (edited) return;
    const suggestion = suggestHandle(email);
    if (suggestion) setDraft(suggestion);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [email, edited]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       Availability is a chain read that follows the typed label. */
    if (!label || problem || !RUMA_REGISTRAR_ADDRESS) return setAvailability("idle");
    setAvailability("checking");
    /* eslint-enable react-hooks/set-state-in-effect */
    const reader = chainReader(mainnetClient, RUMA_REGISTRAR_ADDRESS);
    let cancelled = false;
    const timer = setTimeout(() => {
      reader
        .isAvailable(label)
        .then((available) => !cancelled && setAvailability(available ? "available" : "taken"))
        .catch(() => !cancelled && setAvailability("error"));
    }, CHECK_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [label, problem]);

  const claim = async () => {
    if (!address || availability !== "available" || claiming) return;
    setClaiming(true);
    setError(null);
    try {
      const hash = await requestClaim(label, address, await getAccessToken());
      const receipt = await mainnetClient.waitForTransactionReceipt({ hash, timeout: RECEIPT_TIMEOUT_MS });
      if (receipt.status !== "success") throw new ClaimRequestError("unavailable");
      remember(label);
      router.replace("/home");
    } catch (err) {
      const failure = err instanceof ClaimRequestError ? err.failure : "unavailable";
      if (failure === "taken") setAvailability("taken");
      else setError(t(failure === "hasName" ? "onboarding.username.hasName" : "onboarding.username.claimError"));
      setClaiming(false);
    }
  };

  const status = statusLine(problem, availability);

  return (
    <Screen
      title={t("onboarding.username.title")}
      footer={
        <div className="flex flex-col gap-3">
          <Button variant="black" onClick={claim} disabled={!address || availability !== "available" || claiming}>
            {claiming ? t("onboarding.username.claiming") : t("onboarding.username.claim")}
          </Button>
          {/* Never a dead end: if the writer wallet is down, people can still get into the app. */}
          <button
            onClick={() => router.replace("/home")}
            disabled={claiming}
            style={typography.label3}
            className="py-2 text-text-secondary active:opacity-70 disabled:opacity-50"
          >
            {t("onboarding.username.skip")}
          </button>
        </div>
      }
    >
      <p style={typography.body1} className="mb-6 text-text-secondary">
        {t("onboarding.username.subtitle")}
      </p>

      <p style={typography.label3} className="mb-2">
        {t("onboarding.username.label")}
      </p>
      <Input
        autoFocus
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        disabled={claiming}
        leading={<span className="text-text-secondary">@</span>}
        placeholder={t("onboarding.username.placeholder")}
        value={draft}
        onChange={(e) => {
          setEdited(true);
          setError(null);
          setDraft(e.target.value.toLowerCase());
        }}
        onKeyDown={(e) => e.key === "Enter" && claim()}
      />

      <p style={typography.body5} className={clsx("mt-2 min-h-5", status ? status.className : "text-text-secondary")}>
        {status ? t(status.key) : t("onboarding.username.hint")}
      </p>

      {claiming && (
        <p style={typography.body3} className="mt-4 text-text-secondary">
          {t("onboarding.username.claimingHint")}
        </p>
      )}

      {error && (
        <p style={typography.body3} className="mt-4 text-danger">
          {error}
        </p>
      )}
    </Screen>
  );
}

function statusLine(
  problem: ReturnType<typeof handleProblem>,
  availability: Availability
): { key: TranslationKey; className: string } | null {
  if (problem) return { key: `onboarding.username.${problem}`, className: "text-danger" };
  switch (availability) {
    case "checking":
      return { key: "onboarding.username.checking", className: "text-text-secondary" };
    case "available":
      return { key: "onboarding.username.available", className: "text-primary" };
    case "taken":
      return { key: "onboarding.username.taken", className: "text-danger" };
    case "error":
      return { key: "onboarding.username.checkError", className: "text-danger" };
    default:
      return null;
  }
}
