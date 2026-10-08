"use client";

import { useEffect, useMemo, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { isAddress } from "viem";

import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioCard } from "@/components/ui/radio-card";
import { typography } from "@/constants/typography";

import { FLAGS } from "@/lib/flags";
import { useI18n } from "@/lib/i18n/i18n-context";
import { isValidNetworkAddress } from "@/lib/intents/addresses";
import { assetsForNetwork, findNetwork, isNetworkId, type DepositAsset, type Network } from "@/lib/intents/networks";
import { buildQuoteRequest, parseAmount, refundModeFrom, type Refund } from "@/lib/intents/quote";
import { depositFromQuote, saveDeposit } from "@/lib/intents/deposits";
import { fetchTokens, requestDepositQuote } from "@/lib/intents/api";
import { errorKey } from "@/lib/intents/errors";

const REFUND_MODE = refundModeFrom(process.env.NEXT_PUBLIC_INTENTS_REFUND_MODE);

export default function NetworkAssetPage() {
  // FLAGS is fixed at build time, so this never changes the hook order below.
  if (!FLAGS.multichainDeposits) notFound();
  const { network: networkParam } = useParams<{ network: string }>();
  // Validate before any other hook runs; notFound() throws, so it can't sit above hooks.
  if (!isNetworkId(networkParam)) notFound();
  return <AssetAndAmount network={findNetwork(networkParam)} />;
}

function AssetAndAmount({ network }: { network: Network }) {
  const router = useRouter();
  const { t } = useI18n();
  const { user, getAccessToken } = usePrivy();
  const recipient = user?.wallet?.address;

  const [assets, setAssets] = useState<DepositAsset[] | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState("");
  const [refundAddress, setRefundAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Kept raw and translated at render, so the copy follows the language picker.
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    getAccessToken()
      .then((token) => fetchTokens(token))
      .then((tokens) => {
        if (cancelled) return;
        const available = assetsForNetwork(tokens, network.id);
        setAssets(available);
        setAssetId(available[0]?.assetId ?? null);
      })
      .catch((err) => !cancelled && setError(err ?? new Error("Unknown error")));
    return () => {
      cancelled = true;
    };
  }, [network.id, getAccessToken]);

  const asset = assets?.find((a) => a.assetId === assetId) ?? null;
  const amount = asset ? parseAmount(amountText, asset.decimals) : null;
  const refundValid = REFUND_MODE === "intents" || isValidNetworkAddress(network.id, refundAddress);
  const refund: Refund =
    REFUND_MODE === "intents" ? { type: "INTENTS" } : { type: "ORIGIN_CHAIN", address: refundAddress };
  const usdEstimate = useMemo(() => {
    const value = Number(amountText.replace(",", "."));
    return asset && value > 0 ? `$${(value * asset.priceUsd).toFixed(2)}` : null;
  }, [amountText, asset]);

  // Our own refusals and crashes get translated copy; Aurora's 4xx (e.g. amount
  // below its minimum) is shown as it says, since it tells the user what to change.
  const errorKeyFor = error == null ? null : errorKey(error);
  const errorText =
    error == null ? null : errorKeyFor ? t(errorKeyFor) : error instanceof Error ? error.message : String(error);

  const handleGenerate = async () => {
    if (!asset || !amount || !refundValid || !recipient || !isAddress(recipient)) return;
    setError(null);
    setSubmitting(true);
    try {
      const now = new Date();
      const quote = await requestDepositQuote(buildQuoteRequest({ asset, amount, recipient, refund, now }), await getAccessToken());
      saveDeposit(localStorage, depositFromQuote(quote, network.id, asset.symbol, now));
      router.push(`/add-money/wallet/deposit/${encodeURIComponent(quote.depositAddress)}`);
    } catch (err) {
      setError(err ?? new Error("Unknown error"));
      setSubmitting(false);
    }
  };

  return (
    <Screen
      title={t("intents.asset.title", { network: network.name })}
      backLabel={t("common.back")}
      footer={
        <>
          <Button variant="black" onClick={handleGenerate} disabled={!amount || !refundValid || !recipient || submitting}>
            {submitting ? t("intents.asset.generating") : t("intents.asset.generate")}
          </Button>
          {errorText && (
            <p style={typography.body5} className="mt-3 text-center text-danger">
              {errorText}
            </p>
          )}
        </>
      }
    >
      <h2 style={typography.display3} className="mb-6">
        {t("intents.asset.question")}
      </h2>

      {/* Without a wallet there is nowhere to send the USDC, so the button stays off; say why. */}
      {!recipient && (
        <p style={typography.body3} className="mb-6 text-text-secondary">
          {t("cashflow.receive.noWallet")}
        </p>
      )}

      {assets === null && error == null && (
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
            {t("intents.asset.amount")}
          </label>
          <Input
            inputMode="decimal"
            placeholder="0.00"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
          />
          <p style={typography.body5} className="mt-2 text-text-secondary">
            {amountText && !amount
              ? t("intents.asset.invalidAmount")
              : usdEstimate && t("intents.asset.amountHint", { usd: usdEstimate })}
          </p>
          <p style={typography.body5} className="mt-1 text-text-secondary">
            {t("intents.asset.amountFlex")}
          </p>

          {REFUND_MODE === "origin" && (
            <>
              <label style={typography.body3} className="mt-6 mb-2 block text-text-secondary">
                {t("intents.asset.refund", { network: network.name })}
              </label>
              <Input
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={refundAddress}
                onChange={(e) => setRefundAddress(e.target.value)}
              />
              <p style={typography.body5} className="mt-2 text-text-secondary">
                {refundAddress && !refundValid
                  ? t("intents.asset.invalidRefund", { network: network.name })
                  : t("intents.asset.refundHint")}
              </p>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
