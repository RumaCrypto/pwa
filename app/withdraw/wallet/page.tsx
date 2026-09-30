"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { isAddress, type Address } from "viem";

import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Callout } from "@/components/ui/callout";
import { DetailRow } from "@/components/ui/detail-row";
import { typography } from "@/constants/typography";

import { DEFAULT_SETTLEMENT_NETWORK } from "@/constants/blockchain";
import { useI18n } from "@/lib/i18n/i18n-context";
import { useUsdcBalance } from "@/hooks/use-usdc-balance";
import { useP2pWalletClient } from "@/hooks/use-p2p-wallet-client";
import { sendUsdc } from "@/lib/withdraw/transfers";
import { USDC_DECIMALS } from "@/lib/usdc";

/** Digits with at most USDC's six decimals, using "." or "," as the separator. */
const AMOUNT_PATTERN = new RegExp(`^\\d*([.,]\\d{0,${USDC_DECIMALS}})?$`);

export default function WithdrawWalletScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { user } = usePrivy();
  const { balance } = useUsdcBalance(user?.wallet?.address);
  const getWalletClient = useP2pWalletClient();

  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalised = amount.replace(",", ".");
  const value = Number(normalised);
  const addressTrimmed = address.trim();
  const addressValid = isAddress(addressTrimmed);
  const overBalance = balance !== null && value > Number(balance);
  const ready = value > 0 && addressValid && !overBalance && !submitting;

  const handleConfirm = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const { walletClient, address: from } = await getWalletClient();
      const transfer = await sendUsdc({
        walletClient,
        from,
        to: addressTrimmed as Address,
        amount: normalised,
      });
      router.replace(`/withdraw/wallet/${transfer.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <Screen
      title={t("cashflow.out.wallet")}
      backLabel={t("common.back")}
      footer={
        <>
          <Button variant="black" onClick={handleConfirm} disabled={!ready}>
            {submitting ? t("withdrawFlow.wallet.sending") : t("withdrawFlow.wallet.confirm")}
          </Button>
          {error && (
            <p style={typography.body5} className="mt-3 text-center text-danger">
              {t("withdrawFlow.wallet.failed", { error })}
            </p>
          )}
        </>
      }
    >
      <p style={typography.label3} className="mb-2">
        {t("withdrawFlow.wallet.amount")}
      </p>
      <Input
        value={amount}
        inputMode="decimal"
        onChange={(event) => AMOUNT_PATTERN.test(event.target.value) && setAmount(event.target.value)}
        placeholder="0.00"
        leading={<span className="text-text-secondary">USDC</span>}
      />
      <p style={typography.body5} className="mt-1.5 text-text-secondary">
        {t("withdrawFlow.wallet.available", { balance: balance ?? "—" })}
      </p>
      {overBalance && (
        <p style={typography.body4} className="mt-2 text-danger">
          {t("withdrawFlow.amount.overBalance")}
        </p>
      )}

      <p style={typography.label3} className="mt-5 mb-2">
        {t("withdrawFlow.wallet.address")}
      </p>
      <Input
        value={address}
        onChange={(event) => setAddress(event.target.value)}
        placeholder="0x…"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      {addressTrimmed.length > 0 && !addressValid && (
        <p style={typography.body4} className="mt-2 text-danger">
          {t("withdrawFlow.wallet.invalidAddress")}
        </p>
      )}

      <Card className="mt-6 px-5 py-3">
        <DetailRow label={t("cashflow.receive.network")} value={DEFAULT_SETTLEMENT_NETWORK.name} />
        <DetailRow label={t("cashflow.receive.asset")} value="USDC" />
        <DetailRow label={t("cashflow.cost")} value={t("cashflow.free")} />
      </Card>

      <Callout className="mt-4">
        {t("withdrawFlow.wallet.networkWarning", { network: DEFAULT_SETTLEMENT_NETWORK.name })}
      </Callout>
    </Screen>
  );
}
