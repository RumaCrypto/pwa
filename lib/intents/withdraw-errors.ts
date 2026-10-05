/**
 * Why a withdrawal stopped before or while signing. Each code maps to copy
 * that says whether money left the balance, which is what the user needs to know.
 */
export type WithdrawErrorCode =
  | "mismatch" // the quote does not match what the user confirmed; nothing signed
  | "expired" // too little time left on the quote to sign safely; nothing signed
  | "balance" // the balance no longer covers it; nothing signed
  | "rejected" // the user declined the signature; nothing sent
  | "reverted" // the transfer failed on-chain or before broadcast; nothing sent
  | "unconfirmed"; // broadcast may have happened; the track screen finds out

export class WithdrawError extends Error {
  constructor(readonly code: WithdrawErrorCode) {
    super(`Withdrawal stopped: ${code}`);
    this.name = "WithdrawError";
  }
}
