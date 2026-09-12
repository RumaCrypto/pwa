import type { Money } from "@/lib/money/money";

/**
 * Privy's card product is Bridge (identity and onchain fund movement) in front
 * of Stripe Issuing (the card itself). Both sets of state are modelled here
 * because the screen has to explain to the user which one it is waiting on.
 */

export type KycStatus = "not_started" | "pending" | "approved" | "rejected";
export type EndorsementStatus = "not_requested" | "pending" | "approved";
export type CardStatus = "active" | "frozen" | "canceled";

export interface Card {
  id: string;
  last4: string;
  brand: "visa";
  type: "virtual" | "physical";
  status: CardStatus;
  expiryMonth: number;
  expiryYear: number;
  holder: string;
}

export interface SpendingControls {
  monthlyLimit: Money;
  perPurchaseLimit: Money;
  onlinePurchases: boolean;
}

export interface CardSetup {
  kyc: KycStatus;
  endorsement: EndorsementStatus;
  /**
   * Hash of the ERC-20 approval that lets Bridge's contract pull funds at
   * authorisation time. Without it a card can exist but never settle.
   */
  approvalTxHash?: string;
  card?: Card;
}

export const SETUP_STEPS = ["kyc", "endorsement", "approval", "create"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

/** The one thing standing between the user and a working card, or null. */
export function nextSetupStep(setup: CardSetup): SetupStep | null {
  if (setup.kyc !== "approved") return "kyc";
  if (setup.endorsement !== "approved") return "endorsement";
  if (!setup.approvalTxHash) return "approval";
  if (!setup.card) return "create";
  return null;
}

export function canSpend(card: Card): boolean {
  return card.status === "active";
}

export function formatExpiry(card: Card): string {
  return `${String(card.expiryMonth).padStart(2, "0")}/${String(card.expiryYear).slice(-2)}`;
}
