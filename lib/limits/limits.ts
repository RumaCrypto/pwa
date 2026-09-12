import { fromNumber, type Money } from "@/lib/money/money";

export const SOCIAL_NETWORKS = ["instagram", "x", "github", "linkedin", "facebook"] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

/** Completed sends that earn the top level, on top of a verified document. */
export const SENDS_FOR_TOP_LEVEL = 10;

/** What the user has handed over so far. Nothing is required to open an account. */
export interface Verifications {
  socials: SocialNetwork[] | string[];
  document: boolean;
  completedSends: number;
}

export interface Limits {
  level: number;
  perSend: Money;
  perDay: Money;
  sendsPerDay: number;
}

export const LEVELS: Limits[] = [
  { level: 1, perSend: fromNumber(100, "USD"), perDay: fromNumber(1_000, "USD"), sendsPerDay: 10 },
  { level: 2, perSend: fromNumber(500, "USD"), perDay: fromNumber(5_000, "USD"), sendsPerDay: 20 },
  { level: 3, perSend: fromNumber(2_500, "USD"), perDay: fromNumber(25_000, "USD"), sendsPerDay: 50 },
  { level: 4, perSend: fromNumber(10_000, "USD"), perDay: fromNumber(100_000, "USD"), sendsPerDay: 100 },
];

export const MAX_LEVEL = LEVELS.length;

export type RaiseStep = "social" | "document" | "usage";

export function levelFor(verifications: Verifications): number {
  const { socials, document, completedSends } = verifications;

  // The document is the gate for anything above level two: a record of use
  // raises trust, but it does not stand in for identity.
  if (document && completedSends >= SENDS_FOR_TOP_LEVEL) return 4;
  if (document) return 3;
  if (socials.length > 0) return 2;
  return 1;
}

export function limitsFor(level: number): Limits {
  return LEVELS[Math.min(Math.max(level, 1), MAX_LEVEL) - 1];
}

/** The one thing worth doing next, or null at the top. */
export function nextStepFor(verifications: Verifications): RaiseStep | null {
  if (verifications.socials.length === 0 && !verifications.document) return "social";
  if (!verifications.document) return "document";
  if (verifications.completedSends < SENDS_FOR_TOP_LEVEL) return "usage";
  return null;
}

/** Ceiling each step unlocks, for the badges on the limits screen. */
export function rewardFor(step: RaiseStep): Money | null {
  if (step === "social") return limitsFor(2).perSend;
  if (step === "document") return limitsFor(3).perSend;
  return null;
}
