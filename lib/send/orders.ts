import type { TimelineStepState } from "@/components/ui/timeline";
import type { Quote } from "./quote";

export const STAGES = ["funded", "converted", "paying", "delivered"] as const;
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
 * elapsed time. "awaiting_merchant" covers both "no merchant yet" and
 * "merchant just accepted, submitting payout details"; the UI tells those
 * apart via `acceptedMerchant`, which is set the moment acceptance is seen.
 */
export type OrderPhase = "awaiting_merchant" | "awaiting_completion" | "completed" | "failed";

export interface Order {
  id: string;
  contactId: string;
  quote: Quote;
  createdAt: Date;

  /** The on-chain order id, from the `OrderPlaced` event in the placement receipt. */
  p2pOrderId: bigint;
  placeTxHash: `0x${string}`;
  phase: OrderPhase;
  failureReason?: OrderFailureReason;
  errorMessage?: string;

  /** Set as soon as a merchant is seen accepting, before payout details are even sent. */
  acceptedMerchant?: string;
  actualUsdcAmount?: bigint;
  actualFiatAmount?: bigint;
  completedAt?: Date;
}

export function stageIndex(stage: Stage): number {
  return STAGES.indexOf(stage);
}

/** Where the order visually sits, regardless of whether it's still moving or has failed. */
export function stageFor(order: Order): Stage {
  if (order.phase === "completed") return "delivered";
  if (order.phase === "awaiting_completion") return "paying";
  if (order.acceptedMerchant) return "converted";
  return "funded";
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
