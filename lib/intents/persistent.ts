import { formatUnits, getAddress, isAddress, parseUnits } from "viem";
import { isValidNetworkAddress } from "./addresses";
import { USDC_BASE_ASSET_ID, isNetworkId, type IntentsToken, type NetworkId } from "./networks";

/**
 * Networks that get one permanent deposit address per user instead of a
 * one-time quote. Each deposit is priced when it lands, so a late transfer
 * converts at the current rate instead of being refunded. Tron only for now:
 * people top up USDT from exchanges there, and withdrawals from those can take
 * longer than a quote lasts.
 */
const PERSISTENT_NETWORKS: ReadonlySet<NetworkId> = new Set<NetworkId>(["tron"]);

export function usesPersistentAddress(network: NetworkId): boolean {
  return PERSISTENT_NETWORKS.has(network);
}

export interface DepositMinimum {
  /** As Aurora's token list names it, e.g. "USDT". */
  symbol: string;
  /** In whole units, e.g. "3". */
  amount: string;
}

export interface PersistentTerms {
  /** Anything smaller sits in the address unconverted. */
  minimums: readonly DepositMinimum[];
  /** Roughly what a conversion costs, in USD; it moves with network fees. */
  feeUsd: string;
}

/**
 * Aurora's API reports neither for persistent addresses (a quote's error only
 * gives the bridge floor, which is lower), so these are the figures confirmed
 * by investigating deposits. Update them here when Aurora's change.
 */
const PERSISTENT_TERMS: Partial<Record<NetworkId, PersistentTerms>> = {
  tron: {
    minimums: [
      { symbol: "USDT", amount: "3" },
      { symbol: "TRX", amount: "10" },
    ],
    feeUsd: "1.50",
  },
};

export function persistentTerms(network: NetworkId): PersistentTerms | null {
  return PERSISTENT_TERMS[network] ?? null;
}

/** What the app sends to /api/intents/persistent-address. */
export interface PersistentAddressBody {
  network: NetworkId;
  recipient: string;
}

/** Aurora's `POST /api/persistent-deposit-address` body. */
export interface PersistentAddressRequest {
  recipient: string;
  sender: string;
  depositChain: NetworkId;
  destinationChain: "base";
  destinationAsset: string;
  recipientType: "DESTINATION_CHAIN";
  confidential: false;
}

export interface PersistentAddress {
  depositAddress: string;
  /** Only Stellar sets one; kept so a future memo chain can't silently lose deposits. */
  memo?: string;
}

/**
 * Only a persistent network and an EVM recipient get through. The recipient is
 * checksummed because it is part of the address identity on Aurora's side: the
 * same wallet in another letter case would mint a second address.
 */
export function validatePersistentAddressBody(body: unknown): PersistentAddressBody | null {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.network !== "string" || !isNetworkId(b.network) || !usesPersistentAddress(b.network)) return null;
  if (typeof b.recipient !== "string" || !isAddress(b.recipient, { strict: false })) return null;
  return { network: b.network, recipient: getAddress(b.recipient) };
}

/**
 * `sender` is who the address belongs to. It is the Privy user, taken from the
 * verified session and never from the client, so one user can't mint (or read)
 * another's address. Without auth (local work only) the wallet stands in.
 */
export function buildPersistentAddressRequest(body: PersistentAddressBody, userId: string | null): PersistentAddressRequest {
  return {
    recipient: body.recipient,
    sender: userId ?? body.recipient.toLowerCase(),
    depositChain: body.network,
    destinationChain: "base",
    // The asset ID, not "USDC": a symbol shared by two tokens on Base would be rejected.
    destinationAsset: USDC_BASE_ASSET_ID,
    recipientType: "DESTINATION_CHAIN",
    confidential: false,
  };
}

/** A wrong address here means lost funds, so anything that isn't one for the network fails loudly. */
export function parsePersistentAddress(body: unknown, network: NetworkId): PersistentAddress {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.depositAddress !== "string" || !isValidNetworkAddress(network, b.depositAddress)) {
    throw new Error("Aurora returned no valid deposit address");
  }
  const result: PersistentAddress = { depositAddress: b.depositAddress };
  if (typeof b.memo === "string" && b.memo) result.memo = b.memo;
  return result;
}

/** One entry of Aurora's `GET /api/persistent-deposit-status`: an incoming deposit or an outgoing payout. */
export interface PersistentTransfer {
  txHash: string;
  assetId: string | null;
  decimals: number | null;
  /** In the asset's smallest unit. */
  amount: string;
  createdAt: Date;
}

export type PersistentStatusType = "received" | "success" | "failed";
export const PERSISTENT_STATUS_TYPES: readonly PersistentStatusType[] = ["received", "success", "failed"];

export interface PersistentTransfers {
  transfers: PersistentTransfer[];
  /** Aurora could not read its deposit source, so an empty list means "unknown", not "none". */
  incomplete: boolean;
}

/** Entries Aurora sends malformed are dropped rather than failing the whole history. */
export function parsePersistentTransfers(body: unknown): PersistentTransfers {
  const b = (body ?? {}) as { deposits?: unknown; incomplete?: unknown };
  if (!Array.isArray(b.deposits)) throw new Error("Aurora returned no deposit list");
  const transfers: PersistentTransfer[] = [];
  for (const entry of b.deposits) {
    const d = (entry ?? {}) as Record<string, unknown>;
    const createdAt = typeof d.created_at === "string" ? new Date(d.created_at) : null;
    if (typeof d.tx_hash !== "string" || typeof d.amount !== "string" || !createdAt || Number.isNaN(createdAt.getTime())) {
      continue;
    }
    transfers.push({
      txHash: d.tx_hash,
      assetId: typeof d.asset_id === "string" ? d.asset_id : null,
      decimals: typeof d.decimals === "number" && Number.isInteger(d.decimals) ? d.decimals : null,
      amount: d.amount,
      createdAt,
    });
  }
  return { transfers, incomplete: b.incomplete === true };
}

/** The three lists Aurora keeps per address, as our status route gathers them. */
export interface PersistentHistory {
  received: PersistentTransfer[];
  success: PersistentTransfer[];
  failed: PersistentTransfer[];
  incomplete: boolean;
}

/**
 * Our status route answers `{ received, success, failed, incomplete }`, each
 * list exactly as Aurora sent it, so the same parser reads them here.
 */
export function parsePersistentHistory(body: unknown): PersistentHistory {
  const b = (body ?? {}) as Record<string, unknown>;
  return {
    received: parsePersistentTransfers({ deposits: b.received }).transfers,
    success: parsePersistentTransfers({ deposits: b.success }).transfers,
    failed: parsePersistentTransfers({ deposits: b.failed }).transfers,
    incomplete: b.incomplete === true,
  };
}

export type HistoryStatus = "converting" | "completed" | "failed" | "belowMinimum";

export interface HistoryEntry {
  deposit: PersistentTransfer;
  status: HistoryStatus;
  /** The USDC payout on Base (or the failed attempt) this deposit was matched to. */
  payout?: PersistentTransfer;
}

/** Payouts are logged by another service than deposits, so their clocks may disagree a little. */
const PAIRING_SKEW_MS = 60_000;

/**
 * Aurora lists incoming deposits and outgoing payouts separately, with nothing
 * linking the two. Each deposit is converted and paid out on its own, in the
 * order it arrived, so they are paired first-in, first-out: the oldest deposit
 * with the oldest payout made after it. Deposits without one are still
 * converting. Deposits below the minimum are left out of the pairing, since
 * they stay unconverted. Newest first, as the screen lists them.
 */
export function buildDepositHistory(
  history: Pick<PersistentHistory, "received" | "success" | "failed">,
  belowMinimum: (deposit: PersistentTransfer) => boolean = () => false
): HistoryEntry[] {
  const byTime = (a: PersistentTransfer, b: PersistentTransfer) => a.createdAt.getTime() - b.createdAt.getTime();
  const deposits = [...history.received].sort(byTime);
  const outcomes = [
    ...history.success.map((payout) => ({ payout, status: "completed" as const })),
    ...history.failed.map((payout) => ({ payout, status: "failed" as const })),
  ].sort((a, b) => byTime(a.payout, b.payout));

  let next = 0;
  const entries: HistoryEntry[] = deposits.map((deposit) => {
    // Never converted, so never paid out: pairing it would hand it the next deposit's payout.
    if (belowMinimum(deposit)) return { deposit, status: "belowMinimum" };
    // A payout logged before this deposit belongs to an earlier one that was not listed (e.g. a page cut off).
    while (next < outcomes.length && outcomes[next].payout.createdAt.getTime() < deposit.createdAt.getTime() - PAIRING_SKEW_MS) {
      next += 1;
    }
    if (next >= outcomes.length) return { deposit, status: "converting" };
    const outcome = outcomes[next++];
    return { deposit, status: outcome.status, payout: outcome.payout };
  });
  return entries.reverse();
}

/** How an asset is shown in the history; null when the token list does not know it. */
export function tokenFor(tokens: readonly IntentsToken[], assetId: string | null): IntentsToken | null {
  return assetId ? (tokens.find((t) => t.assetId === assetId) ?? null) : null;
}

const DISPLAY_SYMBOL: Record<string, string> = { wNEAR: "NEAR" };

/**
 * A transfer's amount and symbol for display, e.g. "25.5 USDT". Aurora's own
 * decimals win; the token list fills in when it sends none. Up to 6 decimals,
 * so TRX or BTC dust does not run off the row.
 */
export function formatTransfer(transfer: PersistentTransfer, tokens: readonly IntentsToken[]): string {
  const token = tokenFor(tokens, transfer.assetId);
  const symbol = token ? (DISPLAY_SYMBOL[token.symbol] ?? token.symbol) : "";
  const decimals = transfer.decimals ?? token?.decimals ?? null;
  let amount = transfer.amount;
  if (/^\d+$/.test(amount) && decimals !== null) {
    const [whole, fraction = ""] = formatUnits(BigInt(amount), decimals).split(".");
    const trimmed = fraction.slice(0, 6).replace(/0+$/, "");
    amount = trimmed ? `${whole}.${trimmed}` : whole;
  }
  return symbol ? `${amount} ${symbol}` : amount;
}

/**
 * Whether a deposit is below its asset's minimum, so it will not be converted.
 * False when the asset or its decimals are unknown: "converting" is the safer
 * thing to show than telling someone their money is stuck.
 */
export function isBelowMinimum(transfer: PersistentTransfer, tokens: readonly IntentsToken[], terms: PersistentTerms | null): boolean {
  const token = tokenFor(tokens, transfer.assetId);
  const minimum = token && terms?.minimums.find((m) => m.symbol === token.symbol);
  const decimals = transfer.decimals ?? token?.decimals ?? null;
  if (!minimum || decimals === null || !/^\d+$/.test(transfer.amount)) return false;
  return BigInt(transfer.amount) < parseUnits(minimum.amount, decimals);
}
