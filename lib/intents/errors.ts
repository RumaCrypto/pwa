import { IntentsApiError } from "./api";
import { WithdrawError, type WithdrawErrorCode } from "./withdraw-errors";

export type IntentsErrorKey =
  | "intents.errors.session"
  | "intents.errors.wallet"
  | "intents.errors.rateLimit"
  | "intents.errors.unavailable"
  | "intents.errors.generic"
  | "intents.errors.sessionCheck"
  | "withdrawFlow.errors.recipient";

/** What the quote route answers when the body fails our own validation; the user can't fix that. */
const INVALID_QUOTE_REQUEST = "Invalid quote request";
/** What the guard answers when Privy couldn't be reached to check the session. */
const SESSION_CHECK_UNAVAILABLE = "Could not check your session";

/** The refusals our withdrawal routes answer a bad recipient with (422); any other 422 is Aurora's own. */
const RECIPIENT_REFUSALS = ["Recipient is your own wallet", "Recipient is a token contract", "Recipient account does not exist"];

/**
 * Maps a failed /api/intents call to copy the user can read in their language.
 * Returns null for Aurora's own 4xx answers (e.g. an amount below its minimum):
 * those say what to change and only exist in English, so they are shown as-is.
 */
export function errorKey(err: unknown): IntentsErrorKey | null {
  if (!(err instanceof IntentsApiError)) return "intents.errors.generic";
  switch (err.status) {
    case 401:
      return "intents.errors.session";
    case 403:
      return "intents.errors.wallet";
    case 429:
      return "intents.errors.rateLimit";
    // 404 only comes from our routes when the feature flag is off.
    case 404:
      return "intents.errors.unavailable";
    case 503:
      if (err.message === SESSION_CHECK_UNAVAILABLE) return "intents.errors.sessionCheck";
      return "intents.errors.unavailable";
  }
  if (err.status === 422 && RECIPIENT_REFUSALS.includes(err.message)) return "withdrawFlow.errors.recipient";
  if (err.status === 400 && err.message === INVALID_QUOTE_REQUEST) return "intents.errors.generic";
  if (err.status >= 400 && err.status < 500) return null;
  return "intents.errors.generic";
}

export type WithdrawErrorKey =
  | "withdrawFlow.errors.mismatch"
  | "withdrawFlow.errors.expired"
  | "withdrawFlow.errors.balance"
  | "withdrawFlow.errors.rejected"
  | "withdrawFlow.errors.reverted"
  | "withdrawFlow.errors.gas";

const WITHDRAW_ERROR_KEYS: Record<Exclude<WithdrawErrorCode, "unconfirmed">, WithdrawErrorKey> = {
  mismatch: "withdrawFlow.errors.mismatch",
  expired: "withdrawFlow.errors.expired",
  balance: "withdrawFlow.errors.balance",
  rejected: "withdrawFlow.errors.rejected",
  reverted: "withdrawFlow.errors.reverted",
  gas: "withdrawFlow.errors.gas",
};

/** Copy for a withdrawal that stopped before money moved. "unconfirmed" has none: the screen sends the user to tracking instead. */
export function withdrawErrorKey(err: unknown): WithdrawErrorKey | null {
  if (!(err instanceof WithdrawError) || err.code === "unconfirmed") return null;
  return WITHDRAW_ERROR_KEYS[err.code];
}
