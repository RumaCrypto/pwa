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

interface BaseOrder {
  id: string;
  contactId: string;
  quote: Quote;
  createdAt: Date;
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

/** Placed as a p2p.me sell order — settles through a merchant, in the contact's local currency. */
export interface P2pOrder extends BaseOrder {
  kind: "p2p";
  /** The on-chain order id, from the `OrderPlaced` event in the placement receipt. */
  p2pOrderId: bigint;
}

/**
 * A plain USDC transfer to a "Has Ruma" contact's own wallet on Base. Created
 * `awaiting_completion` the moment the transaction is submitted, and completed
 * once its receipt confirms — no merchant, so only two steps (`RUMA_STAGES`).
 */
export interface RumaTransferOrder extends BaseOrder {
  kind: "ruma";
  /** Gas paid, in wei, read from the receipt once confirmed. */
  networkFeeWei?: bigint;
}

export const RUMA_STAGES = ["submitted", "confirmed"] as const;
export type RumaStage = (typeof RUMA_STAGES)[number];

/** "submitted" is always done — the order only exists once the transaction is on the network. */
export function rumaStageState(stage: RumaStage, order: RumaTransferOrder): TimelineStepState {
  if (stage === "submitted") return "done";
  if (order.phase === "completed") return "done";
  return order.phase === "failed" ? "pending" : "current";
}

export function rumaProgressFor(order: RumaTransferOrder): number {
  return order.phase === "completed" ? 1 : 0.5;
}

export type Order = P2pOrder | RumaTransferOrder;

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
