"use client";

import { useEffect, useRef, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { formatUnits, isAddress, type Address } from "viem";

import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { DetailRow } from "@/components/ui/detail-row";
import { NetworkLogo } from "@/components/ui/network-logos";
import { AddressChunks } from "@/components/cashflow/address-chunks";
import { typography } from "@/constants/typography";
import { DEFAULT_SETTLEMENT_NETWORK } from "@/constants/blockchain";

import { FLAGS } from "@/lib/flags";
import { baseClient } from "@/lib/viem";
import { USDC_ADDRESS_BASE, USDC_DECIMALS, erc20BalanceOfAbi, erc20TransferAbi } from "@/lib/usdc";
import { useI18n } from "@/lib/i18n/i18n-context";
import { useP2pWalletClient } from "@/hooks/use-p2p-wallet-client";
import { findNetwork } from "@/lib/intents/networks";
import { buildWithdrawQuoteRequest, conversionCostUsd, quoteStillHolds, type WithdrawEstimate } from "@/lib/intents/quote";
import { WITHDRAW_FEE } from "@/lib/intents/fee";
import { requestWithdrawQuote, submitDepositTx } from "@/lib/intents/api";
import { errorKey, withdrawErrorKey } from "@/lib/intents/errors";
import { WithdrawError } from "@/lib/intents/withdraw-errors";
import { clearDraft, readDraft, type WithdrawDraft } from "@/lib/intents/withdraw-draft";
import { findActiveWithdrawal } from "@/lib/intents/withdrawals";
import { executeWithdrawal } from "@/lib/intents/withdraw-execution";

export default function WithdrawReviewPage() {
  if (!FLAGS.multichainDeposits) notFound();
  return <WithdrawReview />;
}

function WithdrawReview() {
  const router = useRouter();
  const { t } = useI18n();
  const { user, getAccessToken } = usePrivy();
  const getWalletClient = useP2pWalletClient();
  const owner = user?.wallet?.address;

  const [draft, setDraft] = useState<WithdrawDraft | null | undefined>(undefined);
  const [shown, setShown] = useState<WithdrawEstimate | null>(null);
  const [changed, setChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // Terminal: the transfer may have left but no record exists, so this screen must never offer a retry.
  const [unconfirmed, setUnconfirmed] = useState(false);
  // A ref, not state: a second tap in the same frame must already see the lock (S4).
  const locked = useRef(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       The draft lives in sessionStorage, which only exists after mount. */
    const stored = readDraft(sessionStorage);
    setDraft(stored);
    setShown(stored?.estimate ?? null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  if (draft === undefined) return null;
  if (draft === null || !shown) {
    return (
      <Screen title={t("withdrawFlow.review.title")} backLabel={t("common.back")}>
        <p style={typography.body3} className="text-text-secondary">
          {t("withdrawFlow.review.missing")}
        </p>
      </Screen>
    );
  }

  const network = findNetwork(draft.asset.network);
  const amount = BigInt(draft.amount);
  const cost = conversionCostUsd(shown);

  const handleConfirm = async () => {
    if (locked.current || !owner || !isAddress(owner)) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    setChanged(false);
    // Stays true after a navigation or a terminal state, so the screen can't be used again.
    let keepLocked = false;
    try {
      const active = findActiveWithdrawal(localStorage, new Date());
      if (active) {
        keepLocked = true;
        router.replace(`/withdraw/wallet/track/${encodeURIComponent(active.depositAddress)}`);
        return;
      }

      const token = await getAccessToken();
      const request = buildWithdrawQuoteRequest({
        asset: draft.asset,
        amount,
        recipient: draft.recipient,
        refundTo: owner,
        dry: false,
        now: new Date(),
      });
      const quote = await requestWithdrawQuote(request, token);

      // The price moved below what the user read: show the new numbers and ask again.
      if (!quoteStillHolds(shown, quote)) {
        setShown(quote);
        setChanged(true);
        return;
      }

      const { walletClient, address } = await getWalletClient();
      const withdrawal = await executeWithdrawal(
        { request, quote, asset: draft.asset, confirmedAmount: amount, fee: WITHDRAW_FEE },
        {
          storage: localStorage,
          now: () => new Date(),
          readBalance: () =>
            baseClient.readContract({ address: USDC_ADDRESS_BASE, abi: erc20BalanceOfAbi, functionName: "balanceOf", args: [address] }),
          transfer: (to: Address, value: bigint) =>
            walletClient.writeContract({
              address: USDC_ADDRESS_BASE,
              abi: erc20TransferAbi,
              functionName: "transfer",
              args: [to, value],
              account: address,
              chain: DEFAULT_SETTLEMENT_NETWORK,
            }),
          waitForReceipt: ({ hash }) => baseClient.waitForTransactionReceipt({ hash }),
          submitTx: (hash, depositAddress) => submitDepositTx(hash, depositAddress, token),
        }
      );
      clearDraft(sessionStorage);
      keepLocked = true;
      router.replace(`/withdraw/wallet/track/${encodeURIComponent(withdrawal.depositAddress)}`);
    } catch (err) {
      // Money may have left: the track screen finds out from Aurora.
      if (err instanceof WithdrawError && err.code === "unconfirmed") {
        const active = findActiveWithdrawal(localStorage, new Date());
        clearDraft(sessionStorage);
        keepLocked = true;
        if (active) {
          router.replace(`/withdraw/wallet/track/${encodeURIComponent(active.depositAddress)}`);
        } else {
          setUnconfirmed(true);
        }
        return;
      }
      setError(err ?? new Error("Unknown error"));
    } finally {
      if (!keepLocked) {
        locked.current = false;
        setBusy(false);
      }
    }
  };

  const key = error == null ? null : (withdrawErrorKey(error) ?? errorKey(error));
  const errorText = error == null ? null : key ? t(key) : error instanceof Error ? error.message : String(error);
  const minimum = formatUnits(BigInt(shown.minAmountOut), draft.asset.decimals);

  return (
    <Screen
      title={t("withdrawFlow.review.title")}
      backLabel={t("common.back")}
      footer={
        <>
          {unconfirmed ? (
            <>
              <p style={typography.body3} className="mb-1 text-center font-semibold text-danger">
                {t("withdrawFlow.track.unconfirmed")}
              </p>
              <p style={typography.body5} className="mb-3 text-center text-text-secondary">
                {t("withdrawFlow.track.unconfirmedHint")}
              </p>
              <Button variant="black" onClick={() => router.replace("/home")}>
                {t("intents.done.backHome")}
              </Button>
            </>
          ) : (
            <Button variant="black" onClick={handleConfirm} disabled={busy || !owner}>
              {busy ? t("withdrawFlow.review.sending") : t("withdrawFlow.review.confirm")}
            </Button>
          )}
          {!unconfirmed && (errorText || changed) && (
            <p style={typography.body5} className="mt-3 text-center text-danger">
              {errorText ?? t("withdrawFlow.review.changed")}
            </p>
          )}
        </>
      }
    >
      <h2 style={typography.display3} className="mb-6">
        {t("withdrawFlow.review.question")}
      </h2>

      <Card className="px-5 py-3">
        <DetailRow label={t("withdrawFlow.review.send")} value={`${formatUnits(amount, USDC_DECIMALS)} USDC · Base`} />
        <DetailRow label={t("withdrawFlow.review.receive")} value={`${shown.amountOutFormatted} ${draft.asset.symbol}`} emphasis />
        <DetailRow label={t("withdrawFlow.review.minimum")} value={`${minimum} ${draft.asset.symbol}`} />
        <DetailRow
          label={t("withdrawFlow.review.network")}
          value={
            <span className="inline-flex items-center gap-2">
              <NetworkLogo network={network} size={18} />
              {network.name}
            </span>
          }
        />
        {cost && <DetailRow label={t("withdrawFlow.review.networkFee")} value={`$${cost}`} />}
        {WITHDRAW_FEE.enabled && (
          <DetailRow label={t("withdrawFlow.review.rumaFee")} value={`${formatUnits(WITHDRAW_FEE.amount, USDC_DECIMALS)} USDC`} />
        )}
        <DetailRow
          label={t("withdrawFlow.review.time")}
          value={t("withdrawFlow.review.minutes", { count: Math.max(1, Math.ceil(shown.timeEstimate / 60)) })}
        />
      </Card>

      <Card className="mt-4 px-5 py-4">
        <p style={typography.body3} className="mb-2 text-text-tertiary">
          {t("withdrawFlow.review.address")}
        </p>
        <AddressChunks address={draft.recipient} />
      </Card>

      <Callout className="mt-4">{t("withdrawFlow.review.warning")}</Callout>
    </Screen>
  );
}
