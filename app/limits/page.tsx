"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import clsx from "clsx";
import { AtSign, Check, Fingerprint, IdCard, Landmark, ScanFace, ShieldCheck, type LucideIcon } from "lucide-react";
import type { Address } from "viem";

import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { ListRow } from "@/components/ui/list-row";
import { DetailRow } from "@/components/ui/detail-row";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { useMoney } from "@/lib/money/money-context";
import { useResidency } from "@/lib/settings/residency-context";
import { useTxLimits } from "@/hooks/use-tx-limits";
import { useP2pWalletClient } from "@/hooks/use-p2p-wallet-client";
import {
  ENABLED_METHODS,
  METHOD_COUNTRIES,
  VERIFICATION_METHODS,
  completeLiveness,
  isLivenessConfigured,
  readVerifiedMethods,
  startLiveness,
  type VerificationMethod,
} from "@/lib/limits/reputation";

const METHOD_ICONS: Record<VerificationMethod, LucideIcon> = {
  liveness: ScanFace,
  document: IdCard,
  zkPassport: ShieldCheck,
  social: AtSign,
  aadhaar: Fingerprint,
  bvn: Landmark,
};

type LivenessPhase = "idle" | "starting" | "finishing";

export default function LimitsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { format } = useMoney();
  const { user } = usePrivy();
  const { ready: walletsReady } = useWallets();
  const getWalletClient = useP2pWalletClient();
  const { country, loaded } = useResidency();
  const address = user?.wallet?.address as Address | undefined;

  const { limits, loading, refetch: refetchLimits } = useTxLimits(address, country);
  const [verified, setVerified] = useState<Partial<Record<VerificationMethod, boolean>>>({});
  const [phase, setPhase] = useState<LivenessPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const refetchVerified = useCallback(async () => {
    if (!address) return;
    try {
      setVerified(await readVerifiedMethods(address));
    } catch (err) {
      console.error("Failed to read verifications", err);
    }
  }, [address]);

  useEffect(() => {
    refetchVerified();
  }, [refetchVerified]);

  // The liveness wizard lands back here with `?code=&state=`. Guarded by a ref
  // so a remount can't redeem the one-time code twice.
  const finishing = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code || !address || !walletsReady || finishing.current) return;
    finishing.current = true;

    /* eslint-disable-next-line react-hooks/set-state-in-effect -- reflects the redirect just received. */
    setPhase("finishing");
    (async () => {
      try {
        const { walletClient } = await getWalletClient();
        await completeLiveness({ code, state: params.get("state"), walletClient });
        await Promise.all([refetchVerified(), refetchLimits()]);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setPhase("idle");
        router.replace("/limits");
      }
    })();
  }, [address, walletsReady, getWalletClient, refetchVerified, refetchLimits, router]);

  const verifyLiveness = async () => {
    if (!address) return;
    setError(null);
    setPhase("starting");
    try {
      await startLiveness(address, "/limits");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
      setPhase("idle");
    }
  };

  if (!loaded) return null;

  const methods = VERIFICATION_METHODS.filter((method) => {
    const only = METHOD_COUNTRIES[method];
    return !only || only === country;
  });
  const canBuy = limits !== null && limits.buy.amount > 0n;

  return (
    <Screen title={t("limits.title")} backLabel={t("common.back")}>
      {!country ? (
        <p style={typography.body3} className="text-text-secondary">
          {t("limits.needsCountry")}
        </p>
      ) : (
        <>
          <Card className="px-5 py-3">
            <DetailRow
              label={t("limits.buy")}
              value={
                loading && !limits
                  ? t("common.loading")
                  : limits
                    ? canBuy
                      ? format(limits.buy)
                      : t("limits.locked")
                    : "—"
              }
            />
            <DetailRow
              label={t("limits.sell")}
              value={loading && !limits ? t("common.loading") : limits ? format(limits.sell) : "—"}
            />
          </Card>
          <p style={typography.body4} className="mt-2 px-1 text-text-secondary">
            {t("limits.perOrder")}
          </p>

          {limits && !canBuy && (
            <Callout className="mt-5" title={t("limits.buyLockedTitle")}>
              {t("limits.buyLockedBody")}
            </Callout>
          )}
        </>
      )}

      <h3 style={typography.heading3} className="mb-1 mt-8">
        {t("limits.raise")}
      </h3>
      <p style={typography.body3} className="mb-3 text-text-secondary">
        {t("limits.raiseHint")}
      </p>

      <Card divided>
        {methods.map((method) => {
          const done = verified[method] === true;
          const enabled = ENABLED_METHODS.has(method) && (method !== "liveness" || isLivenessConfigured());
          const busy = method === "liveness" && phase !== "idle";
          const Icon = METHOD_ICONS[method];

          return (
            <ListRow
              key={method}
              className={clsx(!enabled && !done && "opacity-50")}
              leading={<MethodIcon icon={Icon} done={done} />}
              title={t(`limits.method.${method}` as "limits.method.liveness")}
              subtitle={t(`limits.method.${method}Hint` as "limits.method.livenessHint")}
              trailing={
                done ? (
                  <Badge variant="outline">{t("limits.method.done")}</Badge>
                ) : !enabled ? (
                  <Badge variant="outline">{t("limits.method.soon")}</Badge>
                ) : (
                  <Badge variant="dark">
                    {busy
                      ? phase === "finishing"
                        ? t("limits.method.finishing")
                        : t("common.loading")
                      : t("limits.method.verify")}
                  </Badge>
                )
              }
              onClick={enabled && !done && !busy && address ? verifyLiveness : undefined}
            />
          );
        })}
      </Card>

      {error && (
        <p style={typography.body3} className="mt-4 text-danger">
          {error}
        </p>
      )}
    </Screen>
  );
}

function MethodIcon({ icon: Icon, done }: { icon: LucideIcon; done: boolean }) {
  return (
    <span
      className={clsx(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
        done ? "bg-primary text-white" : "bg-primary-light text-primary-dark"
      )}
    >
      {done ? <Check size={16} /> : <Icon size={16} />}
    </span>
  );
}
