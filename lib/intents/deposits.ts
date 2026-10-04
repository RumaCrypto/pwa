import type { NetworkId } from "./networks";
import type { QuoteResult } from "./quote";
import type { DepositPhase } from "./status";

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
