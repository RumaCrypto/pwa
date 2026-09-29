import type { TimelineStepState } from "@/components/ui/timeline";
import type { DepositQuote } from "./quote";

export const STAGES = ["placed", "matched", "paying", "received"] as const;
export type Stage = (typeof STAGES)[number];

/**
 * Terminal failure reasons the tracking screen distinguishes copy for.
 * "cancelled" is the protocol actually cancelling the order on-chain;
 * "timeout" is this app giving up on polling, with the order's true status
 * still unknown; "error" covers a signature rejection, a reverted tx, or a
 * network failure at any step after the order was placed.
 */
export type OrderFailureReason = "cancelled" | "timeout" | "error";

/**
 * Real lifecycle phases, driven by polling the diamond contract — not by
 * elapsed time. A BUY order only knows *where* to send fiat once a seller
 * accepts and publishes their encrypted payment address; "awaiting_payment"
 * is that window, ended by the user confirming they sent the money (which
 * submits `paidBuyOrder` and moves the order to "awaiting_completion").
 */
export type OrderPhase = "awaiting_merchant" | "awaiting_payment" | "awaiting_completion" | "completed" | "failed";

export interface Order {
  /** The on-chain order id, from the `OrderPlaced` event in the placement receipt. */
  id: string;
  quote: DepositQuote;
  createdAt: Date;

  p2pOrderId: bigint;
  placeTxHash: `0x${string}`;
  phase: OrderPhase;
  failureReason?: OrderFailureReason;
  errorMessage?: string;

  /** Set as soon as a seller is seen accepting, before their address is decrypted. */
  acceptedMerchant?: string;
  /** The seller's payment address/details, decrypted from the order's `encUpi`. */
  paymentAddress?: string;
  /** Set once the user confirms they sent the fiat (`paidBuyOrder` submitted). */
  paidTxHash?: `0x${string}`;
  actualUsdcAmount?: bigint;
  actualFiatAmount?: bigint;
  completedAt?: Date;
}

export function stageIndex(stage: Stage): number {
  return STAGES.indexOf(stage);
}

/** Where the order visually sits, regardless of whether it's still moving or has failed. */
export function stageFor(order: Order): Stage {
  if (order.phase === "completed") return "received";
  if (order.phase === "awaiting_completion") return "paying";
  if (order.phase === "awaiting_payment" || order.acceptedMerchant) return "matched";
  return "placed";
}

export function stageState(stage: Stage, order: Order): TimelineStepState {
  const index = stageIndex(stage);
  const current = stageIndex(stageFor(order));

  if (index < current) return "done";
  if (index > current) return "pending";
  return order.phase === "completed" ? "done" : "current";
}

/** A rough step-based fill, since there's no meaningful continuous progress to show. */
export function progressFor(order: Order): number {
  return (stageIndex(stageFor(order)) + 1) / STAGES.length;
}

export function isTerminal(order: Order): boolean {
  return order.phase === "completed" || order.phase === "failed";
}
