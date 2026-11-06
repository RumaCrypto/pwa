import type { Hash } from "viem";
import type { ClaimFailure } from "./claim-errors";

export class ClaimRequestError extends Error {
  constructor(readonly failure: ClaimFailure) {
    super(`Username claim failed: ${failure}`);
    this.name = "ClaimRequestError";
  }
}

/** Asks the server to claim `label` for `address`; resolves with the transaction to wait for. */
export async function requestClaim(label: string, address: string, accessToken: string | null): Promise<Hash> {
  let response: Response;
  try {
    response = await fetch("/api/usernames/claim", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ label, address }),
    });
  } catch {
    throw new ClaimRequestError("unavailable");
  }

  const body = (await response.json().catch(() => null)) as { hash?: Hash; failure?: ClaimFailure } | null;
  if (response.ok && body?.hash) return body.hash;
  throw new ClaimRequestError(body?.failure ?? "unavailable");
}
