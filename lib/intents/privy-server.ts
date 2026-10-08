import "server-only";
import { PrivyClient } from "@privy-io/node";
import { sessionCheckFailure } from "./guard";
import { ownsWallet } from "./wallets";

let client: PrivyClient | null = null;

function privy(): PrivyClient {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const secret = process.env.PRIVY_APP_SECRET;
  if (!appId || !secret) throw new Error("PRIVY_APP_SECRET is not set");
  // With the key from the dashboard, tokens are checked locally instead of
  // fetching Privy's signing keys, which is what times out when Privy is slow.
  const jwtVerificationKey = process.env.PRIVY_VERIFICATION_KEY?.replace(/\\n/g, "\n") || undefined;
  return (client ??= new PrivyClient({ appId, appSecret: secret, jwtVerificationKey }));
}

export async function verifyPrivyToken(token: string): Promise<{ userId: string }> {
  try {
    const claims = await privy().utils().auth().verifyAccessToken(token);
    return { userId: claims.user_id };
  } catch (err) {
    if (sessionCheckFailure(err) === "unavailable") {
      console.error("Privy session check could not run", err instanceof Error ? err.message : "unknown");
      throw Object.assign(new Error("Session check unavailable"), { name: "SessionCheckUnavailable" });
    }
    throw err;
  }
}

/** The quote route checks the deposit lands in one of the caller's own wallets, not someone else's. */
export async function userOwnsWallet(userId: string, address: string): Promise<boolean> {
  const user = await privy().users()._get(userId);
  return ownsWallet(user.linked_accounts, address);
}
