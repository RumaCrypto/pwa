import type { Card, CardSetup, CardStatus, SpendingControls } from "./card";

/** Raw card credentials. See the note on `revealDetails` before using this. */
export interface CardSecrets {
  pan: string;
  cvv: string;
  expiry: string;
}

/**
 * Everything the card screen needs, shaped after Privy's documented pipeline so
 * that wiring the real one is a swap rather than a rewrite.
 *
 * Mapping to the real services, for whoever implements this:
 *
 * - `startKyc` / `getSetup().kyc` — Bridge's KYC flow. Nothing else can start
 *   until it reports approved.
 * - `requestEndorsement` — Bridge's `cards` endorsement on the customer.
 * - `buildApproval` / `recordApproval` — the ERC-20 approval that lets Bridge's
 *   contract pull funds when a purchase is authorised. On EVM the transaction is
 *   sent with `useSendTransaction` from `@privy-io/react-auth`; on Solana with
 *   `useSignAndSendTransaction` from `@privy-io/react-auth/solana`. Only the
 *   sending belongs in the UI — this interface just supplies and records it.
 * - `createCard`, `setStatus`, `setSpendingControls` — Stripe Issuing.
 *
 * Card authorisations arrive as Bridge webhooks (`card_transaction.created` and
 * `card_transaction.updated`), which need a server endpoint; a browser-only
 * implementation cannot observe them.
 */
export interface CardProvider {
  getSetup(): Promise<CardSetup>;
  startKyc(): Promise<CardSetup>;
  requestEndorsement(): Promise<CardSetup>;
  /** Returns the approval call for the wallet to send; does not send it. */
  buildApproval(): Promise<{ to: string; data: string }>;
  recordApproval(txHash: string): Promise<CardSetup>;
  createCard(type: Card["type"]): Promise<CardSetup>;
  setStatus(status: CardStatus): Promise<CardSetup>;

  getSpendingControls(): Promise<SpendingControls>;
  setSpendingControls(controls: Partial<SpendingControls>): Promise<SpendingControls>;

  /**
   * Stripe Issuing never hands raw card numbers to application code: the real
   * implementation returns an ephemeral key and renders the number inside
   * Stripe's own iframe, so the PAN never enters this app's memory or DOM.
   * The shape here exists so the screen can be built; treat returning real
   * values from it as a bug, not a feature.
   */
  revealDetails(): Promise<CardSecrets>;
}
