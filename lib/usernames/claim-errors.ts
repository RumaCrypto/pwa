/** Why a claim was refused, in terms the onboarding screen can explain. */
export type ClaimFailure = "taken" | "hasName" | "invalid" | "unavailable";

/** Contract errors from RumaRegistrar (and the UserRegistry it calls), by name. */
const REVERTS: Record<string, ClaimFailure> = {
  LabelAlreadyRegistered: "taken",
  LabelAlreadyReserved: "taken",
  LabelUsed: "taken",
  AlreadyHasName: "hasName",
  InvalidLabel: "invalid",
  // The writer wallet isn't the registrar's claimer: our setup, not the user's input.
  Unauthorized: "unavailable",
};

/**
 * Maps a viem error to a ClaimFailure. viem wraps the decoded revert a few
 * `cause`s deep, so this walks the chain looking for `data.errorName`.
 * Anything unrecognised (RPC down, writer out of ETH) is "unavailable".
 */
export function claimFailure(err: unknown): ClaimFailure {
  let current: unknown = err;
  for (let depth = 0; current && depth < 10; depth++) {
    const errorName = (current as { data?: { errorName?: unknown } }).data?.errorName;
    if (typeof errorName === "string") return REVERTS[errorName] ?? "unavailable";
    current = (current as { cause?: unknown }).cause;
  }
  return "unavailable";
}

/** Two claims sent at once from the writer can pick the same nonce; the loser is safe to resend. */
export function isNonceClash(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /nonce too low|nonce has already been used|replacement transaction underpriced/i.test(message);
}
