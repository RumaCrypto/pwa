/**
 * Why a withdrawal stopped before or while signing. Each code maps to copy
 * that says whether money left the balance, which is what the user needs to know.
 */
export type WithdrawErrorCode =
  | "mismatch" // the quote does not match what the user confirmed; nothing signed
  | "expired" // too little time left on the quote to sign safely; nothing signed
  | "balance" // the balance no longer covers it; nothing signed
  | "gas" // no ETH on Base for the network fee; nothing sent
  | "rejected" // the user declined the signature; nothing sent
  | "reverted" // the transfer failed on-chain or before broadcast; nothing sent
  | "unconfirmed"; // broadcast may have happened; the track screen finds out

export class WithdrawError extends Error {
  /** Set when a transaction exists on Base, so the screen can link to it. */
  constructor(
    readonly code: WithdrawErrorCode,
    readonly txHash?: string
  ) {
    super(`Withdrawal stopped: ${code}`);
    this.name = "WithdrawError";
  }
}
