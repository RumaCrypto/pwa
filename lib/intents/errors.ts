import { IntentsApiError } from "./api";

export type IntentsErrorKey =
  | "intents.errors.session"
  | "intents.errors.wallet"
  | "intents.errors.rateLimit"
  | "intents.errors.unavailable"
  | "intents.errors.generic";

/** What the quote route answers when the body fails our own validation; the user can't fix that. */
const INVALID_QUOTE_REQUEST = "Invalid quote request";

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
    case 503:
      return "intents.errors.unavailable";
  }
  if (err.status === 400 && err.message === INVALID_QUOTE_REQUEST) return "intents.errors.generic";
  if (err.status >= 400 && err.status < 500) return null;
  return "intents.errors.generic";
}
