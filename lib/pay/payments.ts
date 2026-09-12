import type { TimelineStepState } from "@/components/ui/timeline";
import { add, fromMinor, type Money } from "@/lib/money/money";

/** 1% — $0.20 on the $20 payment shown in the designs. */
export const PAY_FEE_RATE = 0.01;

/** How long the business takes to charge once it has the QR. */
const SETTLE_SECONDS = 25;

/** What the payment has reached. A payer is assigned the moment it is created. */
export const PAY_STAGES = ["assigned", "shared", "settled"] as const;
export type PayStage = (typeof PAY_STAGES)[number];

/** The three rows of the tracking timeline, which lag the stages by one. */
export const PAY_STEPS = ["payer", "scan", "charge"] as const;
export type PayStep = (typeof PAY_STEPS)[number];

/** Index of the step still in progress at each stage; 3 means all are done. */
const CURRENT_STEP: Record<PayStage, number> = { assigned: 1, shared: 2, settled: 3 };

/** The network member who fronts the bill at the point of sale. */
export interface Payer {
  reliability: number;
  payments: number;
  respondsInSeconds: number;
}

export interface Payment {
  id: string;
  amount: Money;
  fee: Money;
  total: Money;
  payer: Payer;
  /** On-chain proof shown on the receipt. */
  receipt: string;
  merchant?: string;
  createdAt: Date;
  /** Set when the user scans the merchant's QR; the flow waits here until then. */
  scannedAt?: Date;
}

function feeOn(amount: Money): Money {
  return fromMinor(BigInt(Math.round(Number(amount.amount) * PAY_FEE_RATE)), amount.currency);
}

function randomHex(bytes: number): string {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return `0x${[...values].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function newPaymentId(): string {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}

export function buildPayment(amount: Money, at: Date = new Date()): Payment {
  const fee = feeOn(amount);

  return {
    id: newPaymentId(),
    amount,
    fee,
    total: add(amount, fee),
    payer: { reliability: 0.98, payments: 1204, respondsInSeconds: 40 },
    receipt: randomHex(20),
    createdAt: at,
  };
}

export function payStageAt(payment: Payment, now: Date = new Date()): PayStage {
  if (!payment.scannedAt) return "assigned";
  const sinceScan = (now.getTime() - payment.scannedAt.getTime()) / 1000;
  return sinceScan >= SETTLE_SECONDS ? "settled" : "shared";
}

export function stepStateAt(step: PayStep, payment: Payment, now: Date = new Date()): TimelineStepState {
  const current = CURRENT_STEP[payStageAt(payment, now)];
  const index = PAY_STEPS.indexOf(step);

  if (index < current) return "done";
  if (index > current) return "pending";
  return "current";
}

export function payProgressAt(payment: Payment, now: Date = new Date()): number {
  if (!payment.scannedAt) return 0.25;
  const sinceScan = (now.getTime() - payment.scannedAt.getTime()) / 1000;
  return Math.min(1, 0.5 + (sinceScan / SETTLE_SECONDS) * 0.5);
}
