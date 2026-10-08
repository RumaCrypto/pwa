import { isExpired, type IntentDeposit } from "./deposits";
import type { NetworkId } from "./networks";
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
  href: string;
}

/** Past its deadline by this much, an unresolved operation is stale rather than in flight. */
const STALE_AFTER_DEADLINE_MS = 6 * 60 * 60 * 1000;

function depositItem(d: IntentDeposit, status: IntentActivityItem["status"]): IntentActivityItem {
  return {
    id: `deposit:${d.depositAddress}`,
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
    id: `withdrawal:${w.depositAddress}`,
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
