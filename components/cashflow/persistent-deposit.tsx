"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Copy } from "lucide-react";
import { isAddress } from "viem";

import { Screen } from "@/components/ui/screen";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Badge } from "@/components/ui/badge";
import { ListRow } from "@/components/ui/list-row";
import { QrCode } from "@/components/ui/qr-code";
import { AddressChunks } from "@/components/cashflow/address-chunks";
import { typography } from "@/constants/typography";

import { useI18n } from "@/lib/i18n/i18n-context";
import { LOCALES } from "@/lib/i18n/languages";
import { formatDayAndTime } from "@/lib/datetime";
import { fetchTokens, requestPersistentAddress } from "@/lib/intents/api";
import { errorKey } from "@/lib/intents/errors";
import { depositSymbols, type IntentsToken, type Network } from "@/lib/intents/networks";
import { buildDepositHistory, formatTransfer, type HistoryEntry, type PersistentAddress } from "@/lib/intents/persistent";
import { usePersistentHistory } from "@/lib/intents/use-persistent-history";

/**
 * The user's permanent deposit address on a network that has one (Tron), with
 * what has arrived at it. No amount or quote: whatever lands is converted to
 * USDC on Base at the rate of the moment, however late it comes.
 */
export function PersistentDeposit({ network }: { network: Network }) {
  const { t, language } = useI18n();
  const { user, getAccessToken } = usePrivy();
  const recipient = user?.wallet?.address;

  const [address, setAddress] = useState<PersistentAddress | null>(null);
  // Only for naming assets in the history; the address works without it.
  const [tokens, setTokens] = useState<IntentsToken[]>([]);
  // Kept raw and translated at render, so the copy follows the language picker.
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!recipient || !isAddress(recipient)) return;
    let cancelled = false;
    getAccessToken()
      .then((token) => requestPersistentAddress(network.id, recipient, token))
      .then((result) => !cancelled && setAddress(result))
      .catch((err) => !cancelled && setError(err ?? new Error("Unknown error")));
    return () => {
      cancelled = true;
    };
  }, [network.id, recipient, getAccessToken, attempt]);

  useEffect(() => {
    let cancelled = false;
    getAccessToken()
      .then((token) => fetchTokens(token))
      .then((list) => !cancelled && setTokens(list))
      .catch((err) => console.error("Failed to load Aurora tokens", err));
    return () => {
      cancelled = true;
    };
  }, [getAccessToken]);

  const { history, failed: historyFailed } = usePersistentHistory(address?.depositAddress ?? null);
  const entries = history ? buildDepositHistory(history) : null;

  const params = {
    network: network.name,
    assets: new Intl.ListFormat(LOCALES[language], { type: "disjunction" }).format(depositSymbols(network.id)),
  };

  const errorKeyFor = error == null ? null : errorKey(error);
  const errorText =
    error == null ? null : errorKeyFor ? t(errorKeyFor) : error instanceof Error ? error.message : String(error);

  const copy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address.depositAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const retry = () => {
    setError(null);
    setAttempt((n) => n + 1);
  };

  return (
    <Screen
      title={t("intents.asset.title", params)}
      backLabel={t("common.back")}
      footer={
        address ? (
          <Button variant="black" onClick={copy}>
            <Copy size={18} />
            {copied ? t("cashflow.receive.copied") : t("cashflow.receive.copy")}
          </Button>
        ) : errorText ? (
          <>
            <Button variant="black" onClick={retry}>
              {t("intents.persistent.retry")}
            </Button>
            <p style={typography.body5} className="mt-3 text-center text-danger">
              {errorText}
            </p>
          </>
        ) : undefined
      }
    >
      {/* Without a wallet there is nowhere to send the USDC; say why nothing shows. */}
      {!recipient && (
        <p style={typography.body3} className="text-text-secondary">
          {t("cashflow.receive.noWallet")}
        </p>
      )}

      {recipient && !address && !errorText && (
        <p style={typography.body3} className="text-text-secondary">
          {t("intents.asset.generating")}
        </p>
      )}

      {address && (
        <>
          {/* Sending another asset or on another network loses the funds, so this is a warning, not a hint. */}
          <Callout>{t("intents.persistent.warning", params)}</Callout>

          <div className="mt-5 flex justify-center">
            <QrCode value={address.depositAddress} label={t("intents.persistent.address", params)} />
          </div>

          <Card className="mt-4 px-5 py-5">
            <p style={typography.body3} className="mb-2 text-text-tertiary">
              {t("intents.persistent.address", params)}
            </p>
            {/* The address is saved and reused, so poisoned look-alikes in the user's history are a real risk. */}
            <AddressChunks address={address.depositAddress} />
            {address.memo && (
              <>
                <p style={typography.body3} className="mt-4 text-text-tertiary">
                  {t("intents.deposit.memo")}
                </p>
                <p style={typography.body2} className="mt-2 break-all font-mono">
                  {address.memo}
                </p>
              </>
            )}
            <p style={typography.body5} className="mt-4 text-text-secondary">
              {t("intents.persistent.reusable")}
            </p>
          </Card>

          <h3 style={typography.heading4} className="mt-8 mb-3">
            {t("intents.persistent.history")}
          </h3>
          <DepositHistory entries={entries} tokens={tokens} failed={historyFailed} incomplete={history?.incomplete ?? false} />
        </>
      )}
    </Screen>
  );
}

function DepositHistory({
  entries,
  tokens,
  failed,
  incomplete,
}: {
  entries: HistoryEntry[] | null;
  tokens: readonly IntentsToken[];
  failed: boolean;
  incomplete: boolean;
}) {
  const { t, language } = useI18n();

  if (entries === null) {
    return (
      <p style={typography.body3} className="text-text-secondary">
        {failed ? t("intents.persistent.historyUnavailable") : t("common.loading")}
      </p>
    );
  }

  const statusBadge = {
    converting: <Badge variant="outline">{t("intents.persistent.converting")}</Badge>,
    completed: <Badge variant="light">{t("intents.persistent.completed")}</Badge>,
    failed: <Badge variant="dark">{t("intents.persistent.failed")}</Badge>,
  };

  return (
    <>
      {(failed || incomplete) && (
        <p style={typography.body5} className="mb-3 text-text-secondary">
          {failed ? t("intents.persistent.historyStale") : t("intents.persistent.historyIncomplete")}
        </p>
      )}
      {entries.length === 0 ? (
        <p style={typography.body3} className="text-text-secondary">
          {t("intents.persistent.empty")}
        </p>
      ) : (
        <Card className="divide-y divide-border-light overflow-hidden">
          {entries.map((entry, i) => {
            const when = formatDayAndTime(entry.deposit.createdAt, language);
            const subtitle =
              entry.status === "completed" && entry.payout
                ? `${when} · ${t("intents.persistent.receivedAs", { amount: formatTransfer(entry.payout, tokens) })}`
                : entry.status === "failed"
                  ? `${when} · ${t("intents.persistent.failedHint")}`
                  : when;
            return (
              <ListRow
                // One transaction can carry two transfers, so the hash alone may repeat.
                key={`${entry.deposit.txHash}-${i}`}
                title={formatTransfer(entry.deposit, tokens)}
                subtitle={subtitle}
                trailing={statusBadge[entry.status]}
              />
            );
          })}
        </Card>
      )}
    </>
  );
}
