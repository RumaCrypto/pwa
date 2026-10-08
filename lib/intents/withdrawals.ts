import { formatUnits } from "viem";
import type { DepositStorage } from "./deposits";
import type { NetworkId, WithdrawAsset } from "./networks";
import type { WithdrawQuote } from "./quote";
import { isTerminal, phaseFor, type DepositPhase, type IntentStatus } from "./status";

const WITHDRAWALS_KEY = "ruma-intent-withdrawals";
/** A second confirm within this window shows the withdrawal in flight instead of starting another. */
const ACTIVE_WINDOW_MS = 30 * 60 * 1000;

/**
 * "awaiting_transfer": saved before the wallet signs, so a crash mid-signature
 * leaves a trace. "transfer_failed": the user declined or the chain rejected
 * it, so nothing left the balance. After that Aurora's phases take over.
 */
export type WithdrawalPhase = "awaiting_transfer" | "transfer_failed" | DepositPhase;

export interface IntentWithdrawal {
  depositAddress: string;
  network: NetworkId;
  assetSymbol: string;
  recipient: string;
  amountInFormatted: string;
  amountOutFormatted: string;
  minAmountOutFormatted: string;
  createdAt: Date;
  deadline: Date;
  phase: WithdrawalPhase;
  transferTxHash?: string;
  receivedFormatted?: string;
  destinationTxHash?: string;
  completedAt?: Date;
}

type Stored = Omit<IntentWithdrawal, "createdAt" | "deadline" | "completedAt"> & {
  createdAt: string;
  deadline: string;
  completedAt?: string;
};

function serialise(w: IntentWithdrawal): Stored {
  return { ...w, createdAt: w.createdAt.toISOString(), deadline: w.deadline.toISOString(), completedAt: w.completedAt?.toISOString() };
}

function revive(stored: Stored): IntentWithdrawal | null {
  const createdAt = new Date(stored.createdAt);
  const deadline = new Date(stored.deadline);
  if (!Number.isFinite(createdAt.getTime()) || !Number.isFinite(deadline.getTime())) return null;
  const w: IntentWithdrawal = {
    ...stored,
    createdAt,
    deadline,
    completedAt: stored.completedAt ? new Date(stored.completedAt) : undefined,
  };
  if (!w.completedAt) delete w.completedAt;
  return w;
}

function readAll(storage: DepositStorage): Record<string, Stored> {
  try {
    const parsed = JSON.parse(storage.getItem(WITHDRAWALS_KEY) ?? "{}");
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function withdrawalFromQuote(quote: WithdrawQuote, asset: WithdrawAsset, recipient: string, now: Date): IntentWithdrawal {
  return {
    depositAddress: quote.depositAddress,
    network: asset.network,
    assetSymbol: asset.symbol,
    recipient,
    amountInFormatted: quote.amountInFormatted,
    amountOutFormatted: quote.amountOutFormatted,
    minAmountOutFormatted: formatUnits(BigInt(quote.minAmountOut), asset.decimals),
    createdAt: now,
    deadline: new Date(quote.deadline),
    phase: "awaiting_transfer",
  };
}

export function saveWithdrawal(storage: DepositStorage, withdrawal: IntentWithdrawal): void {
  const all = readAll(storage);
  all[withdrawal.depositAddress] = serialise(withdrawal);
  storage.setItem(WITHDRAWALS_KEY, JSON.stringify(all));
}

export function getWithdrawal(storage: DepositStorage, address: string): IntentWithdrawal | undefined {
  const stored = readAll(storage)[address];
  if (!stored) return undefined;
  const w = revive(stored);
  return w ?? undefined;
}

export function updateWithdrawal(
  storage: DepositStorage,
  address: string,
  patch: Partial<IntentWithdrawal>
): IntentWithdrawal | undefined {
  const current = getWithdrawal(storage, address);
  if (!current) return undefined;
  const updated = { ...current, ...patch };
  saveWithdrawal(storage, updated);
  return updated;
}

export function isWithdrawalSettled(phase: WithdrawalPhase): boolean {
  return phase === "transfer_failed" || (phase !== "awaiting_transfer" && isTerminal(phase));
}

export function findActiveWithdrawal(storage: DepositStorage, now: Date): IntentWithdrawal | undefined {
  return Object.values(readAll(storage))
    .map((stored) => {
      if (stored === null || typeof stored !== "object") return null;
      return revive(stored);
    })
    .filter((w): w is IntentWithdrawal => w !== null)
    .find((w) => !isWithdrawalSettled(w.phase) && now.getTime() - w.createdAt.getTime() < ACTIVE_WINDOW_MS);
}

/**
 * Aurora says PENDING_DEPOSIT both before and right after a transfer it has
 * not seen yet, so a withdrawal whose transfer was never confirmed stays
 * "awaiting_transfer" until Aurora reports the deposit: claiming it was sent
 * could lead the user to assume the money left, or to retry and pay twice.
 * "transfer_failed" is final: if the wallet declined or the chain rejected
 * the transfer, the stored state is authoritative regardless of Aurora's status.
 */
export function withdrawalPhaseFor(stored: WithdrawalPhase, status: IntentStatus): WithdrawalPhase {
  if (stored === "transfer_failed") return "transfer_failed";
  if (stored === "awaiting_transfer" && status === "PENDING_DEPOSIT") return "awaiting_transfer";
  return phaseFor(status);
}

const DEPOSITS_KEY = "ruma-intent-deposits";

/**
 * True when the address is one of the user's own one-time deposit addresses
 * (from a top-up or an earlier withdrawal): sending there would credit
 * Aurora's swap, not a wallet the user controls.
 */
export function isOwnIntentAddress(storage: Pick<DepositStorage, "getItem">, address: string): boolean {
  const wanted = address.trim().toLowerCase();
  if (!wanted) return false;
  return [DEPOSITS_KEY, WITHDRAWALS_KEY].some((key) => {
    try {
      const parsed: unknown = JSON.parse(storage.getItem(key) ?? "{}");
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return false;
      return Object.values(parsed).some((entry) => {
        const stored = (entry as { depositAddress?: unknown } | null)?.depositAddress;
        return typeof stored === "string" && stored.toLowerCase() === wanted;
      });
    } catch {
      return false;
    }
  });
}
