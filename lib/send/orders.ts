import type { TimelineStepState } from "@/components/ui/timeline";
import type { Quote } from "./quote";

export const STAGES = ["funded", "converted", "paying", "delivered"] as const;
export type Stage = (typeof STAGES)[number];

/**
 * Seconds after creation at which the mock order reaches each stage. A real
 * p2p.me order reports its own state; deriving it from elapsed time here means
 * the tracking screen survives a reload with no timers to persist.
 */
const STAGE_AT_SECONDS: Record<Stage, number> = {
  funded: 0,
  converted: 5,
  paying: 12,
  delivered: 45,
};

export interface Order {
  id: string;
  contactId: string;
  quote: Quote;
  createdAt: Date;
  cancelledAt?: Date;
}

export function stageIndex(stage: Stage): number {
  return STAGES.indexOf(stage);
}

export function stageAt(createdAt: Date, now: Date = new Date()): Stage {
  const elapsed = (now.getTime() - createdAt.getTime()) / 1000;
  let reached: Stage = "funded";
  for (const stage of STAGES) {
    if (elapsed >= STAGE_AT_SECONDS[stage]) reached = stage;
  }
  return reached;
}

export function stageStateAt(stage: Stage, createdAt: Date, now: Date = new Date()): TimelineStepState {
  const current = stageIndex(stageAt(createdAt, now));
  const index = stageIndex(stage);

  if (index < current) return "done";
  if (index > current) return "pending";
  return stage === "delivered" ? "done" : "current";
}

export function progressAt(createdAt: Date, now: Date = new Date()): number {
  const elapsed = (now.getTime() - createdAt.getTime()) / 1000;
  const total = STAGE_AT_SECONDS.delivered;
  // Starts a little above zero so the bar reads as started, not stuck.
  return Math.min(1, Math.max(0.08, elapsed / total));
}

export function estimatedArrival(createdAt: Date): Date {
  return new Date(createdAt.getTime() + STAGE_AT_SECONDS.delivered * 1000);
}

/** Matches the "RM-719049" format in the designs. */
export function newOrderId(): string {
  return `RM-${Math.floor(100_000 + Math.random() * 900_000)}`;
}
