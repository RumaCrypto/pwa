"use client";

import { useEffect, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { formatUnits, isAddress, parseUnits } from "viem";

import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioCard } from "@/components/ui/radio-card";
import { NetworkLogo } from "@/components/ui/network-logos";
import { typography } from "@/constants/typography";

import { FLAGS } from "@/lib/flags";
import { USDC_DECIMALS } from "@/lib/usdc";
import { useI18n } from "@/lib/i18n/i18n-context";
import { useUsdcBalance } from "@/hooks/use-usdc-balance";
import { isValidNetworkAddress } from "@/lib/intents/addresses";
import { findNetwork, isNetworkId, withdrawAssetsForNetwork, type Network, type WithdrawAsset } from "@/lib/intents/networks";
import { parseAmount } from "@/lib/intents/quote";
import { WITHDRAW_FEE, maxWithdrawable } from "@/lib/intents/fee";
import { fetchTokens } from "@/lib/intents/api";
import { errorKey } from "@/lib/intents/errors";
import { saveDraft } from "@/lib/intents/withdraw-draft";
import { useWithdrawEstimate } from "@/lib/intents/use-withdraw-estimate";

export default function WithdrawNetworkPage() {
  // FLAGS is fixed at build time, so this never changes the hook order below.
  if (!FLAGS.multichainDeposits) notFound();
  const { network: networkParam } = useParams<{ network: string }>();
  if (!isNetworkId(networkParam)) notFound();
  return <WithdrawForm network={findNetwork(networkParam)} />;
}

function WithdrawForm({ network }: { network: Network }) {
  const router = useRouter();
  const { t } = useI18n();
  const { user, getAccessToken } = usePrivy();
  const owner = user?.wallet?.address;
  const { balance } = useUsdcBalance(owner);

  const [assets, setAssets] = useState<WithdrawAsset[] | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  // Starts empty on purpose: nothing is ever prefilled from the URL (S5).
  const [recipient, setRecipient] = useState("");
  const [amountText, setAmountText] = useState("");
  const [loadError, setLoadError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    getAccessToken()
      .then((token) => fetchTokens(token))
      .then((tokens) => {
        if (cancelled) return;
        const available = withdrawAssetsForNetwork(tokens, network.id);
        setAssets(available);
        setAssetId(available[0]?.assetId ?? null);
      })
      .catch((err) => !cancelled && setLoadError(err ?? new Error("Unknown error")));
    return () => {
      cancelled = true;
    };
  }, [network.id, getAccessToken]);

  const asset = assets?.find((a) => a.assetId === assetId) ?? null;
  const trimmed = recipient.trim();
  const addressValid = isValidNetworkAddress(network.id, trimmed);
  const isOwnAddress = !!owner && trimmed.toLowerCase() === owner.toLowerCase();
  const max = balance === null ? null : maxWithdrawable(parseUnits(balance, USDC_DECIMALS), WITHDRAW_FEE);
  const amount = parseAmount(amountText, USDC_DECIMALS);
  const tooMuch = amount !== null && max !== null && amount > max;
  const refundTo = owner && isAddress(owner) ? owner : null;
  const ready = asset && max !== null && addressValid && !isOwnAddress && amount && !tooMuch && refundTo;

  const { estimate, loading, error: estimateError } = useWithdrawEstimate(
    ready ? { asset: asset!, recipient: trimmed, amount: amount!, refundTo: refundTo! } : null
  );

  const error = loadError ?? estimateError;
  const errorKeyFor = error == null ? null : errorKey(error);
  const errorText =
    error == null ? null : errorKeyFor ? t(errorKeyFor) : error instanceof Error ? error.message : String(error);

  const paste = async () => {
    // Only on an explicit tap: the clipboard is never read on its own (S5).
    try {
      setRecipient((await navigator.clipboard.readText()).trim());
    } catch {
      // Permission denied: the user can still paste by hand.
    }
  };

  const handleReview = () => {
    if (!ready || !estimate) return;
    saveDraft(sessionStorage, { asset: asset!, recipient: trimmed, amount: amount!.toString(), estimate });
    router.push("/withdraw/wallet/review");
  };

  const addressHint =
    trimmed && !addressValid
      ? t("withdrawFlow.form.invalidAddress", { network: network.name })
      : isOwnAddress
        ? t("withdrawFlow.form.ownAddress")
        : null;

  return (
    <Screen
      title={t("withdrawFlow.form.title", { network: network.name })}
      backLabel={t("common.back")}
      footer={
        <>
          <Button variant="black" onClick={handleReview} disabled={!ready || !estimate || loading}>
            {t("withdrawFlow.form.review")}
          </Button>
          {errorText && (
            <p style={typography.body5} className="mt-3 text-center text-danger">
              {errorText}
            </p>
          )}
        </>
      }
    >
      <div className="mb-6 flex items-center gap-3">
        <NetworkLogo network={network} />
        <h2 style={typography.display3}>{network.name}</h2>
      </div>

      {assets === null && loadError == null && (
        <p style={typography.body3} className="text-text-secondary">
          {t("intents.asset.loading")}
        </p>
      )}
      {assets?.length === 0 && (
        <p style={typography.body3} className="text-text-secondary">
          {t("intents.asset.empty")}
        </p>
      )}

      {assets && assets.length > 0 && (
        <>
          <p style={typography.body3} className="mb-2 text-text-secondary">
            {t("withdrawFlow.form.asset")}
          </p>
          <div role="radiogroup" className="flex flex-col gap-3">
            {assets.map((option) => (
              <RadioCard
                key={option.assetId}
                title={option.symbol}
                selected={option.assetId === assetId}
                onSelect={() => setAssetId(option.assetId)}
              />
            ))}
          </div>

          <label style={typography.body3} className="mt-6 mb-2 block text-text-secondary">
            {t("withdrawFlow.form.address", { network: network.name })}
          </label>
          <div className="flex gap-2">
            <Input
              className="flex-1 font-mono"
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
            <Button variant="secondary" className="w-auto! shrink-0 px-4" onClick={paste}>
              {t("withdrawFlow.form.paste")}
            </Button>
          </div>
          {addressHint && (
            <p style={typography.body5} className="mt-2 text-danger">
              {addressHint}
            </p>
          )}

          <label style={typography.body3} className="mt-6 mb-2 block text-text-secondary">
            {t("withdrawFlow.form.amount")}
          </label>
          <div className="flex gap-2">
            <Input
              className="flex-1"
              inputMode="decimal"
              placeholder="0.00"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
            />
            <Button
              variant="secondary"
              className="w-auto! shrink-0 px-4"
              disabled={max === null || max === 0n}
              onClick={() => max !== null && setAmountText(formatUnits(max, USDC_DECIMALS))}
            >
              {t("withdrawFlow.form.max")}
            </Button>
          </div>
          <p style={typography.body5} className="mt-2 text-text-secondary">
            {amountText && !amount
              ? t("intents.asset.invalidAmount")
              : tooMuch
                ? t("withdrawFlow.form.tooMuch")
                : max !== null && t("withdrawFlow.form.available", { amount: formatUnits(max, USDC_DECIMALS) })}
          </p>

          {ready && (
            <p style={typography.body2} className="mt-4">
              {loading || !estimate
                ? t("withdrawFlow.form.estimating")
                : t("withdrawFlow.form.estimate", { amount: estimate.amountOutFormatted, asset: asset!.symbol })}
            </p>
          )}
        </>
      )}
    </Screen>
  );
}
