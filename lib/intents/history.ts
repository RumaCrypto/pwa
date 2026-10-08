import { isExpired, type IntentDeposit } from "./deposits";
import { USDC_BASE_ASSET_ID, displaySymbol, isNetworkId, type IntentsToken, type NetworkId } from "./networks";
import type { IntentWithdrawal } from "./withdrawals";

/**
 * A deposit or withdrawal through Aurora, as the home screen lists it. The
 * on-chain history only sees a USDC transfer to or from one of Aurora's
 * one-time addresses; this says what actually happened.
 */
export interface IntentActivityItem {
  id: string;
  kind: "deposit" | "withdrawal";
  network: NetworkId;
  /** USDC that reached (deposit) or left (withdrawal) the Ruma balance. */
  usdc: string;
  /** The other side of the conversion, e.g. "1.95 USDT". */
  other: string;
  status: "delivered" | "pending" | "failed";
  occurredAt: Date;
  /** The tracking screen, which needs this device's record; null for operations made elsewhere. */
  href: string | null;
}

/** Past its deadline by this much, an unresolved operation is stale rather than in flight. */
const STALE_AFTER_DEADLINE_MS = 6 * 60 * 60 * 1000;

function depositItem(d: IntentDeposit, status: IntentActivityItem["status"]): IntentActivityItem {
  return {
    id: `deposit:${d.depositAddress.toLowerCase()}`,
    kind: "deposit",
    network: d.network,
    usdc: d.receivedFormatted ?? d.amountOutFormatted,
    other: `${d.amountInFormatted} ${d.assetSymbol}`,
    status,
    occurredAt: d.completedAt ?? d.createdAt,
    href: `/add-money/wallet/deposit/${encodeURIComponent(d.depositAddress)}`,
  };
}

function withdrawalItem(w: IntentWithdrawal, status: IntentActivityItem["status"]): IntentActivityItem {
  return {
    id: `withdrawal:${w.depositAddress.toLowerCase()}`,
    kind: "withdrawal",
    network: w.network,
    usdc: w.amountInFormatted,
    other: `${w.receivedFormatted ?? w.amountOutFormatted} ${w.assetSymbol}`,
    status,
    occurredAt: w.completedAt ?? w.createdAt,
    href: `/withdraw/wallet/track/${encodeURIComponent(w.depositAddress)}`,
  };
}

function depositStatus(d: IntentDeposit): IntentActivityItem["status"] | null {
  switch (d.phase) {
    case "awaiting_deposit":
      return null; // an address nobody has sent to yet: no money moved
    case "completed":
      return "delivered";
    case "refunded":
    case "failed":
      return "failed";
    default:
      return "pending";
  }
}

function withdrawalStatus(w: IntentWithdrawal): IntentActivityItem["status"] | null {
  switch (w.phase) {
    case "transfer_failed":
      return null; // the USDC never left the balance
    case "completed":
      return "delivered";
    case "refunded":
    case "failed":
      return "failed";
    default:
      return "pending";
  }
}

const newestFirst = (a: IntentActivityItem, b: IntentActivityItem) => b.occurredAt.getTime() - a.occurredAt.getTime();

/** Deposits and withdrawals that moved money, newest first. */
export function intentActivity(deposits: IntentDeposit[], withdrawals: IntentWithdrawal[]): IntentActivityItem[] {
  const items: IntentActivityItem[] = [];
  for (const d of deposits) {
    const status = depositStatus(d);
    if (status) items.push(depositItem(d, status));
  }
  for (const w of withdrawals) {
    const status = withdrawalStatus(w);
    if (status) items.push(withdrawalItem(w, status));
  }
  return items.sort(newestFirst);
}

/**
 * The newest operation still in flight, for the banner on the home screen. An
 * address still waiting for the user's transfer counts, since that is exactly
 * what they may have left the app to go do.
 */
export function activeIntent(deposits: IntentDeposit[], withdrawals: IntentWithdrawal[], now: Date): IntentActivityItem | null {
  const fresh = (deadline: Date) => now.getTime() <= deadline.getTime() + STALE_AFTER_DEADLINE_MS;
  const candidates: IntentActivityItem[] = [];

  for (const d of deposits) {
    if (d.phase === "awaiting_deposit" || d.phase === "incomplete") {
      if (!isExpired(d, now)) candidates.push(depositItem(d, "pending"));
    } else if (d.phase === "processing" && fresh(d.deadline)) {
      candidates.push(depositItem(d, "pending"));
    }
  }
  for (const w of withdrawals) {
    if (withdrawalStatus(w) === "pending" && fresh(w.deadline)) candidates.push(withdrawalItem(w, "pending"));
  }

  return candidates.sort((a, b) => newestFirst(a, b))[0] ?? null;
}

const REMOTE_STATUS: Record<string, IntentActivityItem["status"] | null> = {
  // Nothing reached Aurora's address yet, so no money has moved.
  PENDING_DEPOSIT: null,
  KNOWN_DEPOSIT_TX: "pending",
  PROCESSING: "pending",
  INCOMPLETE_DEPOSIT: "pending",
  SUCCESS: "delivered",
  REFUNDED: "failed",
  FAILED: "failed",
};

/**
 * Aurora's transaction history for the user's wallets, as activity rows. It is
 * what lets a deposit or withdrawal made on another device (or before the
 * browser's storage was cleared) still show up.
 */
export function remoteActivity(body: unknown, tokens: readonly IntentsToken[], wallets: readonly string[]): IntentActivityItem[] {
  const list = Array.isArray(body) ? body : (body as { data?: unknown } | null)?.data;
  if (!Array.isArray(list)) return [];
  const own = new Set(wallets.map((w) => w.toLowerCase()));
  const tokenFor = (assetId: unknown) => tokens.find((t) => t.assetId === assetId);

  return list.flatMap((entry): IntentActivityItem[] => {
    if (entry === null || typeof entry !== "object") return [];
    const tx = entry as Record<string, unknown>;
    const status = typeof tx.status === "string" ? REMOTE_STATUS[tx.status] : undefined;
    const occurredAt = new Date(typeof tx.createdAt === "string" ? tx.createdAt : NaN);
    if (!status || !Number.isFinite(occurredAt.getTime())) return [];
    if (typeof tx.depositAddress !== "string" || typeof tx.amountInFormatted !== "string" || typeof tx.amountOutFormatted !== "string") {
      return [];
    }

    const origin = tokenFor(tx.originAsset);
    const destination = tokenFor(tx.destinationAsset);
    if (!origin || !destination) return [];
    const address = tx.depositAddress.toLowerCase();

    if (tx.originAsset === USDC_BASE_ASSET_ID && tx.destinationAsset !== USDC_BASE_ASSET_ID) {
      if (!isNetworkId(destination.blockchain)) return [];
      return [
        {
          id: `withdrawal:${address}`,
          kind: "withdrawal",
          network: destination.blockchain,
          usdc: tx.amountInFormatted,
          other: `${tx.amountOutFormatted} ${displaySymbol(destination.symbol)}`,
          status,
          occurredAt,
          href: null,
        },
      ];
    }
    if (tx.destinationAsset === USDC_BASE_ASSET_ID && typeof tx.recipient === "string" && own.has(tx.recipient.toLowerCase())) {
      if (!isNetworkId(origin.blockchain)) return [];
      return [
        {
          id: `deposit:${address}`,
          kind: "deposit",
          network: origin.blockchain,
          usdc: tx.amountOutFormatted,
          other: `${tx.amountInFormatted} ${displaySymbol(origin.symbol)}`,
          status,
          occurredAt,
          href: null,
        },
      ];
    }
    return [];
  });
}

/**
 * One row per operation. Aurora's view wins on status and amounts (it saw the
 * settlement); this device's record supplies the link to its tracking screen.
 */
export function mergeIntentActivity(local: IntentActivityItem[], remote: IntentActivityItem[]): IntentActivityItem[] {
  const byId = new Map(local.map((item) => [item.id, item]));
  for (const item of remote) {
    const mine = byId.get(item.id);
    byId.set(item.id, mine ? { ...item, href: mine.href } : item);
  }
  return [...byId.values()].sort(newestFirst);
}

/** Rows from the history route's JSON, with dates restored; anything malformed is dropped. */
export function reviveActivity(json: unknown): IntentActivityItem[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((row): IntentActivityItem[] => {
    if (row === null || typeof row !== "object") return [];
    const r = row as Record<string, unknown>;
    const occurredAt = new Date(typeof r.occurredAt === "string" ? r.occurredAt : NaN);
    const ok =
      typeof r.id === "string" &&
      (r.kind === "deposit" || r.kind === "withdrawal") &&
      typeof r.network === "string" &&
      isNetworkId(r.network) &&
      typeof r.usdc === "string" &&
      typeof r.other === "string" &&
      (r.status === "delivered" || r.status === "pending" || r.status === "failed") &&
      Number.isFinite(occurredAt.getTime());
    // Links are never taken from the server: only this device's records may point somewhere.
    return ok ? [{ ...(r as unknown as IntentActivityItem), occurredAt, href: null }] : [];
  });
}
