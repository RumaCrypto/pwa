const DETAILS_KEY = "ruma-withdraw-payout-details";

/** Field values by country, so switching residency doesn't discard the old country's details. */
type StoredDetails = Record<string, Record<string, string>>;

function readAll(): StoredDetails {
  try {
    const raw = localStorage.getItem(DETAILS_KEY);
    return raw ? (JSON.parse(raw) as StoredDetails) : {};
  } catch {
    return {};
  }
}

/** The local payment fields the user last saved for withdrawing to `country`, or null. */
export function loadPayoutDetails(country: string): Record<string, string> | null {
  return readAll()[country] ?? null;
}

export function savePayoutDetails(country: string, fieldValues: Record<string, string>): void {
  try {
    localStorage.setItem(DETAILS_KEY, JSON.stringify({ ...readAll(), [country]: fieldValues }));
  } catch {
    // Storage full or blocked: the details still travel in memory for this withdrawal.
  }
}
