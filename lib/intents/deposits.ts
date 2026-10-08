import type { NetworkId } from "./networks";
import type { QuoteResult } from "./quote";
import { isTerminal, type DepositPhase } from "./status";

const DEPOSITS_KEY = "ruma-intent-deposits";

export interface IntentDeposit {
  depositAddress: string;
  depositMemo?: string;
  network: NetworkId;
  assetSymbol: string;
  amountInFormatted: string;
  /** Aurora's estimate at quote time; `receivedFormatted` is what actually landed. */
  amountOutFormatted: string;
  createdAt: Date;
  deadline: Date;
  phase: DepositPhase;
  receivedFormatted?: string;
  destinationTxHash?: string;
  completedAt?: Date;
}

export type DepositStorage = Pick<Storage, "getItem" | "setItem">;

type StoredDeposit = Omit<IntentDeposit, "createdAt" | "deadline" | "completedAt"> & {
  createdAt: string;
  deadline: string;
  completedAt?: string;
};

function serialise(deposit: IntentDeposit): StoredDeposit {
  return {
    ...deposit,
    createdAt: deposit.createdAt.toISOString(),
    deadline: deposit.deadline.toISOString(),
    completedAt: deposit.completedAt?.toISOString(),
  };
}

function revive(stored: StoredDeposit): IntentDeposit {
  const deposit: IntentDeposit = {
    ...stored,
    createdAt: new Date(stored.createdAt),
    deadline: new Date(stored.deadline),
    completedAt: stored.completedAt ? new Date(stored.completedAt) : undefined,
  };
  if (!deposit.completedAt) delete deposit.completedAt;
  return deposit;
}

function readAll(storage: DepositStorage): Record<string, StoredDeposit> {
  try {
    const parsed = JSON.parse(storage.getItem(DEPOSITS_KEY) ?? "{}");
    // Guard against valid JSON that isn't an object (null, array, string, etc.)
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}

export function depositFromQuote(quote: QuoteResult, network: NetworkId, assetSymbol: string, now: Date): IntentDeposit {
  return {
    depositAddress: quote.depositAddress,
    depositMemo: quote.depositMemo,
    network,
    assetSymbol,
    amountInFormatted: quote.amountInFormatted,
    amountOutFormatted: quote.amountOutFormatted,
    createdAt: now,
    deadline: new Date(quote.deadline),
    phase: "awaiting_deposit",
  };
}

/**
 * Aurora may still pick up a transfer broadcast just before the deadline, so
 * the address is only shown as expired a little after it.
 */
export const EXPIRY_GRACE_MS = 2 * 60 * 1000;

/**
 * Past the deadline Aurora refunds anything sent to the address, so a deposit
 * still waiting for (more) funds must stop presenting it as usable. Once funds
 * arrived the deadline no longer matters: Aurora settles or refunds on its own.
 */
export function isExpired(deposit: Pick<IntentDeposit, "phase" | "deadline">, now: Date): boolean {
  const waiting = deposit.phase === "awaiting_deposit" || deposit.phase === "incomplete";
  return waiting && now.getTime() > deposit.deadline.getTime() + EXPIRY_GRACE_MS;
}

/** What the status poller does after a status is known: stop, mark the address expired and stop, or poll again. */
export function nextPollAction(phase: DepositPhase, deadline: Date, now: Date): "stop" | "expired" | "continue" {
  if (isTerminal(phase)) return "stop";
  return isExpired({ phase, deadline }, now) ? "expired" : "continue";
}

export function saveDeposit(storage: DepositStorage, deposit: IntentDeposit): void {
  const all = readAll(storage);
  all[deposit.depositAddress] = serialise(deposit);
  storage.setItem(DEPOSITS_KEY, JSON.stringify(all));
}

export function getDeposit(storage: DepositStorage, address: string): IntentDeposit | undefined {
  const stored = readAll(storage)[address];
  return stored ? revive(stored) : undefined;
}

export function updateDeposit(
  storage: DepositStorage,
  address: string,
  patch: Partial<IntentDeposit>
): IntentDeposit | undefined {
  const current = getDeposit(storage, address);
  if (!current) return undefined;
  const updated = { ...current, ...patch };
  saveDeposit(storage, updated);
  return updated;
}
